import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildReport,
  fetchAllPlugins,
  normalizeRepoUrl,
  parseD1Snapshot,
  parseLedgerJsonl,
  parseLogSignals,
  reportToMarkdown,
} from './reconcile.js';

interface Options {
  ledger: string;
  apiBase: string;
  logs?: string;
  d1Export?: string;
  jsonOut: string;
  markdownOut: string;
}

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error(`参数格式错误: ${key ?? ''}`);
    values.set(key, value);
  }
  const ledger = values.get('--ledger');
  const apiBase = values.get('--api-base');
  if (!ledger || !apiBase) throw new Error('必须提供 --ledger 和 --api-base');
  return {
    ledger,
    apiBase,
    logs: values.get('--logs'),
    d1Export: values.get('--d1-export'),
    jsonOut: values.get('--json-out') ?? 'ledger-reconciliation.json',
    markdownOut: values.get('--markdown-out') ?? 'ledger-reconciliation.md',
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const parsed = parseLedgerJsonl(readFileSync(resolve(options.ledger), 'utf8'));
  const livePlugins = await fetchAllPlugins(options.apiBase);
  const liveRepoUrls = new Set(
    livePlugins
      .map((plugin) => {
        try {
          return normalizeRepoUrl(plugin.repoUrl);
        } catch {
          return null;
        }
      })
      .filter((value): value is string => value !== null),
  );
  const d1BySubmissionId = options.d1Export
    ? parseD1Snapshot(JSON.parse(readFileSync(resolve(options.d1Export), 'utf8')) as unknown)
    : new Map();
  const logSignals = options.logs ? parseLogSignals(readFileSync(resolve(options.logs), 'utf8')) : new Map();
  const report = buildReport({
    ledger: parsed.records,
    liveRepoUrls,
    d1BySubmissionId,
    logSignals,
    logEvidenceProvided: Boolean(options.logs),
  });
  writeFileSync(resolve(options.jsonOut), `${JSON.stringify({ ...report, diagnostics: parsed }, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(options.markdownOut), reportToMarkdown(report, parsed), 'utf8');
  console.log(JSON.stringify({ summary: report.summary, diagnostics: {
    errors: parsed.errors.length,
    duplicates: parsed.duplicates.length,
    conflicts: parsed.conflicts.length,
  } }, null, 2));
  if (parsed.errors.length > 0 || parsed.duplicates.length > 0 || parsed.conflicts.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '对账失败');
  process.exitCode = 1;
});
