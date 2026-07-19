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

The D1 snapshot must be a JSON array (or an object with a `results` array) containing submission rows. Invalid JSONL, normalized duplicates, conflicts, incomplete API pagination, and API failures produce a non-zero exit code. Replay candidates are informational only.
