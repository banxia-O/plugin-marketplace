import { describe, expect, it, vi } from 'vitest';
import { buildReport, fetchAllPlugins, normalizeRepoUrl, parseLedgerJsonl } from '../src/reconcile.js';

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
    });
    expect(report.summary.live).toBe(1);
    expect(report.summary.never_dispatched).toBe(1);
    expect(report.replayCandidates).toHaveLength(1);
    expect(report).not.toHaveProperty('applied');
  });
});
