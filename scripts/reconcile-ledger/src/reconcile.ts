export type Classification =
  | 'live'
  | 'ledger_stale'
  | 'never_dispatched'
  | 'no_review_log'
  | 'github_403_legacy'
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
  seen?: boolean;
  started?: boolean;
  completed?: boolean;
  rejected?: boolean;
  github403Legacy?: boolean;
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
  logEvidenceProvided: boolean;
}

export interface ReconciledRow extends LedgerRecord {
  classification: Classification;
  evidence: string[];
}

export interface ReconciliationReport {
  generatedAt: string;
  readOnly: true;
  summary: {
    rowCount: Record<Classification, number>;
    uniqueRepoCount: Record<Classification, number>;
    totalRows: number;
    totalUniqueRepos: number;
  };
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
  const baseEvidence = [
    'public_api=missing',
    `log_seen=${signal?.seen === true}`,
    `log_started=${signal?.started === true}`,
    `log_completed=${signal?.completed === true}`,
    `log_rejected=${signal?.rejected === true}`,
    `d1_status=${d1?.status ?? 'unavailable'}`,
  ];
  if (signal?.github403Legacy) {
    return { classification: 'github_403_legacy', evidence: [...baseEvidence, 'legacy_github_403=true'] };
  }
  if (signal?.githubRateLimit || d1?.last_error_code?.includes('rate_limit')) {
    return { classification: 'github_rate_limit', evidence: [...baseEvidence, 'rate_limit_evidence=true'] };
  }
  const typedBusinessRejection = ['business_rejection', 'github_not_found'].includes(d1?.last_error_code ?? '');
  if (signal?.businessRejected || typedBusinessRejection) {
    return { classification: 'business_rejected', evidence: [...baseEvidence, 'business_rejection_evidence=true'] };
  }
  if (d1?.status === 'done' || signal?.completed) {
    return { classification: 'done_but_not_visible', evidence: [...baseEvidence, 'completion_evidence=true'] };
  }
  if (record.submissionId === undefined) {
    return { classification: 'never_dispatched', evidence: ['public_api=missing', 'submission_id=missing'] };
  }
  if (input.logEvidenceProvided && !signal?.seen) {
    return { classification: 'no_review_log', evidence: [...baseEvidence, 'full_log_has_no_submission=true'] };
  }
  return {
    classification: 'processing_or_unknown',
    evidence: baseEvidence,
  };
}

function emptyCounts(): Record<Classification, number> {
  return {
    live: 0,
    ledger_stale: 0,
    never_dispatched: 0,
    no_review_log: 0,
    github_403_legacy: 0,
    github_rate_limit: 0,
    business_rejected: 0,
    processing_or_unknown: 0,
    done_but_not_visible: 0,
  };
}

export function buildReport(input: ReconcileInput): ReconciliationReport {
  const rowCount = emptyCounts();
  const uniqueRepoCount = emptyCounts();
  const rows = input.ledger.map((record) => {
    const result = classify(record, input);
    rowCount[result.classification] += 1;
    return { ...record, ...result };
  });
  const uniqueRows = new Map<string, ReconciledRow>();
  for (const row of rows) if (!uniqueRows.has(row.normalizedRepoUrl)) uniqueRows.set(row.normalizedRepoUrl, row);
  for (const row of uniqueRows.values()) uniqueRepoCount[row.classification] += 1;

  const replayable = new Set<Classification>([
    'never_dispatched',
    'no_review_log',
    'github_403_legacy',
    'github_rate_limit',
  ]);
  const replayCandidates = [...uniqueRows.values()]
    .filter((row) => replayable.has(row.classification))
    .map((row) => ({
      repoUrl: row.normalizedRepoUrl,
      ...(row.submissionId === undefined ? {} : { submissionId: row.submissionId }),
      classification: row.classification,
    }));
  const summary = {
    rowCount,
    uniqueRepoCount,
    totalRows: rows.length,
    totalUniqueRepos: uniqueRows.size,
  };
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
    current.seen = true;
    if (/开始审核|\bstart(?:ed|ing)?\b/i.test(line)) current.started = true;
    if (/审核完成|\bcompleted?\b/i.test(line)) current.completed = true;
    if (/拒绝|\brejected?\b/i.test(line)) current.rejected = true;
    const legacy403 = /GitHub API\s*返回\s*403/i.test(line);
    if (legacy403) current.github403Legacy = true;
    if (!legacy403 && /rate.?limit|HTTP\s*429|速率限制/i.test(line)) current.githubRateLimit = true;
    if (!legacy403 && /business_rejection|github_not_found|许可证|私有仓库|已归档|安全扫描未通过|license|private repository|archived|security scan/i.test(line)) {
      current.businessRejected = true;
    }
    signals.set(id, current);
  }
  return signals;
}

function markdownCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
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
    `- Total rows: ${report.summary.totalRows}`,
    `- Total unique repositories: ${report.summary.totalUniqueRepos}`,
    '',
    '| Classification | Rows | Unique repositories |',
    '|---|---:|---:|',
    ...Object.entries(report.summary.rowCount).map(
      ([key, count]) => `| ${key} | ${count} | ${report.summary.uniqueRepoCount[key as Classification]} |`,
    ),
    '',
    '## Input diagnostics',
    '',
    `- Invalid JSON/rows: ${diagnostics.errors.length}`,
    `- Duplicate normalized repositories: ${diagnostics.duplicates.length}`,
    `- Conflicting duplicate repositories: ${diagnostics.conflicts.length}`,
    `- Replay candidates (report only): ${report.replayCandidates.length}`,
    '',
    '## Details',
    '',
    '| Line | Classification | Repository | Submission | Ledger status | Evidence |',
    '|---:|---|---|---:|---|---|',
    ...report.rows.map((row) =>
      `| ${row.line} | ${row.classification} | ${markdownCell(row.normalizedRepoUrl)} | ${row.submissionId ?? ''} | ${markdownCell(row.status ?? '')} | ${markdownCell(row.evidence.join('; '))} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
