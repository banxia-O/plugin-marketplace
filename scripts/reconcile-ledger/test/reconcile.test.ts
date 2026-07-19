import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildReport, fetchAllPlugins, normalizeRepoUrl, parseLedgerJsonl, parseLogSignals, reportToMarkdown } from '../src/reconcile.js';

describe('ledger reconciliation', () => {
  it('normalizes equivalent GitHub repository URLs', () => {
    expect(normalizeRepoUrl('git+https://GitHub.com/OpenAI/Example.git/')).toBe('https://github.com/openai/example');
    expect(normalizeRepoUrl('https://github.com/openai/example?tab=readme')).toBe('https://github.com/openai/example');
  });

  it('reports malformed JSON, duplicates, and conflicts', () => {
    const parsed = parseLedgerJsonl([
      '{"repoUrl":"https://github.com/a/b","status":"queued"}',
      '{bad json}',
      '{"repoUrl":"https://github.com/A/B.git","status":"done"}',
    ].join('\n'));
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.duplicates).toHaveLength(1);
    expect(parsed.conflicts).toHaveLength(1);
  });

  it('fetches every API page', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      return new Response(JSON.stringify({
        plugins: page === 1
          ? [{ repoUrl: 'https://github.com/a/one' }]
          : [{ repoUrl: 'https://github.com/a/two' }],
        total: 2,
        page,
        pageSize: 1,
      }), { status: 200 });
    });
    const plugins = await fetchAllPlugins('https://market.example', fetcher, 1);
    expect(plugins).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fails on an API error instead of producing a partial report', async () => {
    await expect(fetchAllPlugins('https://market.example', vi.fn().mockResolvedValue(new Response('', { status: 500 })))).rejects.toThrow(/500/);
  });

  it('classifies rows and only reports replay candidates without applying them', () => {
    const report = buildReport({
      ledger: [
        { line: 1, repoUrl: 'https://github.com/a/live', normalizedRepoUrl: 'https://github.com/a/live', status: 'done' },
        { line: 2, repoUrl: 'https://github.com/a/missing', normalizedRepoUrl: 'https://github.com/a/missing', status: 'queued' },
      ],
      liveRepoUrls: new Set(['https://github.com/a/live']),
      d1BySubmissionId: new Map(),
      logSignals: new Map(),
      logEvidenceProvided: false,
    });
    expect(report.summary.rowCount.live).toBe(1);
    expect(report.summary.rowCount.never_dispatched).toBe(1);
    expect(report.summary.totalRows).toBe(2);
    expect(report.summary.totalUniqueRepos).toBe(2);
    expect(report.replayCandidates).toHaveLength(1);
    expect(report).not.toHaveProperty('applied');
    expect(reportToMarkdown(report, { records: [], errors: [], duplicates: [], conflicts: [] })).toContain('| live |');
    expect(reportToMarkdown(report, { records: [], errors: [], duplicates: [], conflicts: [] })).toContain('https://github.com/a/live');
  });

  it('reproduces the historical 31/6/74 gap evidence from a redacted fixture', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/historical-gap-shape.json', import.meta.url), 'utf8')) as {
      legacy403: { startSubmissionId: number; count: number };
      businessRejected: { startSubmissionId: number; licenseCount: number; archivedCount: number };
      noReviewLog: { startSubmissionId: number; count: number };
    };
    const ledger: Array<{ line: number; repoUrl: string; normalizedRepoUrl: string; submissionId: number; status: string }> = [];
    const logs: string[] = [];
    let line = 1;
    for (let offset = 0; offset < fixture.legacy403.count; offset += 1) {
      const submissionId = fixture.legacy403.startSubmissionId + offset;
      const repoUrl = `https://github.com/redacted/legacy-403-${offset}`;
      ledger.push({ line: line++, repoUrl, normalizedRepoUrl: repoUrl, submissionId, status: 'rejected' });
      logs.push(`[pipeline] #${submissionId} 拒绝：GitHub API 返回 403`);
    }
    const businessCount = fixture.businessRejected.licenseCount + fixture.businessRejected.archivedCount;
    for (let offset = 0; offset < businessCount; offset += 1) {
      const submissionId = fixture.businessRejected.startSubmissionId + offset;
      const repoUrl = `https://github.com/redacted/business-${offset}`;
      ledger.push({ line: line++, repoUrl, normalizedRepoUrl: repoUrl, submissionId, status: 'rejected' });
      logs.push(offset < fixture.businessRejected.licenseCount
        ? `[pipeline] #${submissionId} 拒绝：仓库未声明许可证`
        : `[pipeline] #${submissionId} 拒绝：仓库已归档`);
    }
    for (let offset = 0; offset < fixture.noReviewLog.count; offset += 1) {
      const submissionId = fixture.noReviewLog.startSubmissionId + offset;
      const repoUrl = `https://github.com/redacted/no-log-${offset}`;
      ledger.push({ line: line++, repoUrl, normalizedRepoUrl: repoUrl, submissionId, status: 'rejected' });
    }

    const report = buildReport({
      ledger,
      liveRepoUrls: new Set(),
      d1BySubmissionId: new Map(),
      logSignals: parseLogSignals(logs.join('\n')),
      logEvidenceProvided: true,
    });
    expect(report.summary.rowCount.github_403_legacy).toBe(31);
    expect(report.summary.rowCount.business_rejected).toBe(6);
    expect(report.summary.rowCount.no_review_log).toBe(74);
    expect(report.summary.uniqueRepoCount).toMatchObject({
      github_403_legacy: 31,
      business_rejected: 6,
      no_review_log: 74,
    });
    expect(report.replayCandidates).toHaveLength(105);
  });

  it('does not treat done-but-not-visible as an automatic re-review candidate', () => {
    const repoUrl = 'https://github.com/redacted/done-hidden';
    const report = buildReport({
      ledger: [{ line: 1, repoUrl, normalizedRepoUrl: repoUrl, submissionId: 88 }],
      liveRepoUrls: new Set(),
      d1BySubmissionId: new Map([[88, { id: 88, status: 'done' }]]),
      logSignals: new Map(),
      logEvidenceProvided: false,
    });
    expect(report.summary.rowCount.done_but_not_visible).toBe(1);
    expect(report.replayCandidates).toHaveLength(0);
  });
});
