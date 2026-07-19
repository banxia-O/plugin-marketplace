# Read-only ledger reconciliation

This command compares the JSONL curation ledger with the complete paginated public plugin API. It can optionally consume an offline D1 JSON snapshot and review-service log file. It only writes local JSON and Markdown reports; it has no apply or replay mode.

```powershell
pnpm --filter @ppx/reconcile-ledger build
node scripts/reconcile-ledger/dist/index.js `
  --ledger data/curation/uploaded_plugins.jsonl `
  --api-base https://plugin.md-banxia.cn `
  --d1-export path/to/offline-submissions.json `
  --logs path/to/offline-review.log `
  --json-out ledger-reconciliation.json `
  --markdown-out ledger-reconciliation.md
```

The D1 snapshot must be a JSON array (or an object with a `results` array) containing submission rows. Supply `--logs` only when the file is the complete log range being audited; absence of a submission ID in that full log is evidence for `no_review_log`.

The report includes row counts, unique-repository counts, and per-row evidence. Legacy `GitHub API 返回 403` entries are separated from validated rate-limit failures, and a ledger `rejected` status alone is not treated as business-rejection evidence. `done_but_not_visible` rows are diagnostics and are never automatic replay candidates.

Invalid JSONL, normalized duplicates, conflicts, incomplete API pagination, and API failures produce a non-zero exit code. Replay candidates are informational only; this tool has no replay or apply path.
