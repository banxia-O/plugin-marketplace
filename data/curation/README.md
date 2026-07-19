# Plugin curation ledger

`uploaded_plugins.jsonl` is the shared curation and deduplication ledger used during batch plugin submission.

## Important semantics

- This file records curation/submission history and public repository metadata.
- It is **not** the authoritative publication state of the live marketplace.
- Values such as `basic`, `queued`, `done`, or a `submissionId` do not by themselves prove that a plugin is visible online.
- Before using it for replay or repair, reconcile normalized `repoUrl` values against the complete paginated production API, D1 submission state, and review-service logs.
- Never bulk-replay missing rows without rechecking license, archive status, duplicates, and transient GitHub API failures.

Canonical runtime copy:

```text
/root/.hermes/plugin-marketplace/uploaded_plugins.jsonl
```

The repository copy is a portable snapshot for backup, auditing, and cross-agent handoff.
