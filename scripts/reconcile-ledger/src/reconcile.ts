export type Classification =
  | 'live'
  | 'ledger_stale'
  | 'never_dispatched'
  | 'github_rate_limit'
  | 'business_rejected'
  | 'processing_or_unknown'
  | 'done_but_not_visible';

export interface LedgerRecord {
  line: number;
  repoUrl: string;
  normalizedRepoUrl: string;
  status?: string;
  source?: string;
  submissionId?: number;
  [key: string]: unknown;
}

export interface ParsedLedger {
  records: LedgerRecord[];
  errors: Array<{ line: number; message: string }>;
  duplicates: Array<{ normalizedRepoUrl: string; lines: number[] }>;
  conflicts: Array<{ normalizedRepoUrl: string; lines: number[]; fields: string[] }>;
}

export interface D1SubmissionSnapshot {
  id: number;
  status: string;
  last_error_code?: string | null;
  last_error_message?: string | null;
}

export interface LogSignal {
  githubRateLimit?: boolean;
  businessRejected?: boolean;
}

export function normalizeRepoUrl(value: string): string {
  const candidate = value.trim().replace(/^git\+/, '').replace(/\/+$/, '');
  const url = new URL(candidate);
  if (url.hostname.toLowerCase() !== 'github.com') {
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  }
  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !rawRepo) throw new Error(`不是 GitHub 仓库 URL: ${value}`);
  return `https://github.com/${owner.toLowerCase()}/${rawRepo.replace(/\.git$/i, '').toLowerCase()}`;
}

export function parseLedgerJsonl(content: string): ParsedLedger {
  const records: LedgerRecord[] = [];
  const errors: ParsedLedger['errors'] = [];
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = index + 1;
    if (!rawLine.trim()) continue;
    try {
      const value = JSON.parse(rawLine) as Record<string, unknown>;
      if (typeof value['repoUrl'] !== 'string') throw new Error('repoUrl 缺失');
      records.push({
        ...value,
        line,
        repoUrl: value['repoUrl'],
        normalizedRepoUrl: normalizeRepoUrl(value['repoUrl']),
        status: typeof value['status'] === 'string' ? value['status'] : undefined,
        source: typeof value['source'] === 'string' ? value['source'] : undefined,
        submissionId: typeof value['submissionId'] === 'number' ? value['submissionId'] : undefined,
      });
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : '无法解析' });
    }
  }

  const byRepo = new Map<string, LedgerRecord[]>();
  for (const record of records) {
    const list = byRepo.get(record.normalizedRepoUrl) ?? [];
    list.push(record);
    byRepo.set(record.normalizedRepoUrl, list);
  }
  const duplicates: ParsedLedger['duplicates'] = [];
  const conflicts: ParsedLedger['conflicts'] = [];
  for (const [normalizedRepoUrl, rows] of byRepo) {
    if (rows.length < 2) continue;
    duplicates.push({ normalizedRepoUrl, lines: rows.map((row) => row.line) });
    const fields = ['status', 'source', 'submissionId', 'slug'].filter(
      (field) => new Set(rows.map((row) => JSON.stringify(row[field]))).size > 1,
    );
    if (fields.length > 0) conflicts.push({ normalizedRepoUrl, lines: rows.map((row) => row.line), fields });
  }
  return { records, errors, duplicates, conflicts };
}

interface ApiPlugin {
  repoUrl: string;
  [key: string]: unknown;
}

export async function fetchAllPlugins(
  apiBase: string,
  fetcher: typeof fetch = fetch,
  pageSize = 100,
): Promise<ApiPlugin[]> {
  const base = apiBase.replace(/\/$/, '');
  const endpoint = base.endsWith('/api') ? `${base}/plugins` : `${base}/api/plugins`;
  const plugins: ApiPlugin[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (plugins.length < total) {
    const url = new URL(endpoint);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`插件 API 第 ${page} 页返回 HTTP ${response.status}`);
    const body = (await response.json()) as { plugins?: ApiPlugin[]; total?: number };
    if (!Array.isArray(body.plugins) || typeof body.total !== 'number') {
      throw new Error(`插件 API 第 ${page} 页响应格式无效`);
    }
    total = body.total;
    plugins.push(...body.plugins);
    if (body.plugins.length === 0 && plugins.length < total) throw new Error(`插件 API 在读取完 total 前返回空页`);
    page += 1;
    if (page > 10_000) throw new Error('插件 API 分页超过安全上限');
  }
  return plugins;
}

export interface ReconcileInput {
  ledger: LedgerRecord[];
  liveRepoUrls: Set<string>;
  d1BySubmissionId: Map<number, D1SubmissionSnapshot>;
  logSignals: Map<number, LogSignal>;
}

export interface ReconciledRow extends LedgerRecord {
  classification: Classification;
  evidence: string[];
}

export interface ReconciliationReport {
  generatedAt: string;
  readOnly: true;
  summary: Record<Classification, number>;
  rows: ReconciledRow[];
  replayCandidates: Array<{ repoUrl: string; submissionId?: number; classification: Classification }>;
}

function classify(record: LedgerRecord, input: ReconcileInput): { classification: Classification; evidence: string[] } {
  const live = input.liveRepoUrls.has(record.normalizedRepoUrl);
  if (live) {
    const ledgerLooksFinal = ['done', 'basic', 'verified'].includes(record.status ?? '');
    return {
      classification: ledgerLooksFinal ? 'live' : 'ledger_stale',
      evidence: [`public_api=present`, `ledger_status=${record.status ?? 'missing'}`],
    };
  }

  const signal = record.submissionId === undefined ? undefined : input.logSignals.get(record.submissionId);
  const d1 = record.submissionId === undefined ? undefined : input.d1BySubmissionId.get(record.submissionId);
  if (signal?.githubRateLimit || d1?.last_error_code?.includes('rate_limit')) {
    return { classification: 'github_rate_limit', evidence: ['public_api=missing', 'rate_limit_evidence=true'] };
  }
  if (signal?.businessRejected || d1?.status === 'rejected' || record.status === 'rejected') {
    return { classification: 'business_rejected', evidence: ['public_api=missing', 'business_rejection_evidence=true'] };
  }
  if (d1?.status === 'done') {
    return { classification: 'done_but_not_visible', evidence: ['public_api=missing', 'd1_status=done'] };
  }
  if (record.submissionId === undefined) {
    return { classification: 'never_dispatched', evidence: ['public_api=missing', 'submission_id=missing'] };
  }
  return {
    classification: 'processing_or_unknown',
    evidence: ['public_api=missing', `d1_status=${d1?.status ?? 'unavailable'}`],
  };
}

export function buildReport(input: ReconcileInput): ReconciliationReport {
  const summary: Record<Classification, number> = {
    live: 0,
    ledger_stale: 0,
    never_dispatched: 0,
    github_rate_limit: 0,
    business_rejected: 0,
    processing_or_unknown: 0,
    done_but_not_visible: 0,
  };
  const rows = input.ledger.map((record) => {
    const result = classify(record, input);
    summary[result.classification] += 1;
    return { ...record, ...result };
  });
  const replayable = new Set<Classification>(['never_dispatched', 'github_rate_limit', 'done_but_not_visible']);
  const replayCandidates = rows
    .filter((row) => replayable.has(row.classification))
    .map((row) => ({
      repoUrl: row.normalizedRepoUrl,
      ...(row.submissionId === undefined ? {} : { submissionId: row.submissionId }),
      classification: row.classification,
    }));
  return { generatedAt: new Date().toISOString(), readOnly: true, summary, rows, replayCandidates };
}

export function parseD1Snapshot(value: unknown): Map<number, D1SubmissionSnapshot> {
  const root = value as { results?: unknown[] };
  const rows = Array.isArray(value) ? value : root && Array.isArray(root.results) ? root.results : null;
  if (!rows) throw new Error('D1 导出必须是 JSON 数组或包含 results 数组的对象');
  const result = new Map<number, D1SubmissionSnapshot>();
  for (const valueRow of rows) {
    const row = valueRow as Record<string, unknown>;
    if (typeof row['id'] !== 'number' || typeof row['status'] !== 'string') continue;
    result.set(row['id'], {
      id: row['id'],
      status: row['status'],
      last_error_code: typeof row['last_error_code'] === 'string' ? row['last_error_code'] : null,
      last_error_message: typeof row['last_error_message'] === 'string' ? row['last_error_message'] : null,
    });
  }
  return result;
}

export function parseLogSignals(content: string): Map<number, LogSignal> {
  const signals = new Map<number, LogSignal>();
  for (const line of content.split(/\r?\n/)) {
    const idMatch = line.match(/(?:submissionId["'=:\s]+|#)(\d+)/i);
    if (!idMatch?.[1]) continue;
    const id = Number(idMatch[1]);
    const current = signals.get(id) ?? {};
    if (/rate.?limit|HTTP\s*(403|429)|速率限制/i.test(line)) current.githubRateLimit = true;
    if (/business_rejection|许可证|私有仓库|已归档|安全扫描未通过/i.test(line)) current.businessRejected = true;
    signals.set(id, current);
  }
  return signals;
}

export function reportToMarkdown(report: ReconciliationReport, diagnostics: ParsedLedger): string {
  const lines = [
    '# Ledger reconciliation report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '> Read-only report. No submission, replay, database write, or production mutation was performed.',
    '',
    '## Summary',
    '',
    '| Classification | Count |',
    '|---|---:|',
    ...Object.entries(report.summary).map(([key, count]) => `| ${key} | ${count} |`),
    '',
    '## Input diagnostics',
    '',
    `- Invalid JSON/rows: ${diagnostics.errors.length}`,
    `- Duplicate normalized repositories: ${diagnostics.duplicates.length}`,
    `- Conflicting duplicate repositories: ${diagnostics.conflicts.length}`,
    `- Replay candidates (report only): ${report.replayCandidates.length}`,
    '',
  ];
  return lines.join('\n');
}
