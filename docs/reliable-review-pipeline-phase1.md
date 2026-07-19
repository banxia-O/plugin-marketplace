# Phase 1 reliable review pipeline

## Scope and root cause

The original submission endpoint inserted a `queued` row and then issued a fire-and-forget HTTP request. Network errors were only logged, non-2xx responses were ignored, and no durable retry state or complete job payload existed. GitHub 401/403/rate-limit failures were also converted into business rejections. This made technical failures look final and left no safe way to reconcile them.

This phase intentionally does not change frontend, trending, biomed, plugin list query behavior, the curation ledger, or production data. The 111 historical ledger-only rows are not replayed.

## D1 outbox decision

Phase 1 uses the `submissions` row itself as a D1-backed outbox instead of adding Cloudflare Queues. A new queue and DLQ would require production resource creation and binding decisions that are outside this change. The D1 design keeps payload persistence and the initial `queued` state in one SQL statement, then uses a five-minute scheduled drain plus an immediate best-effort drain.

Only rows created by the new code receive `next_attempt_at`. Migrated legacy rows keep it `NULL`, so the scheduler cannot replay historical queued submissions. A future Cloudflare Queues migration can consume the same versioned payload and state machine.

## State machine

```text
queued -> dispatching -> processing -> done
                  |          |------> rejected (business decisions only)
                  |          |------> retry_wait -> dispatching
                  |          |------> failed (non-retryable technical error)
                  |          `------> dead_letter (attempt limit)
                  |------> retry_wait
                  |------> failed
                  `------> dead_letter
```

All transitions are checked centrally. Dispatch claims are conditional, each delivery carries an attempt number, and duplicate or stale callbacks are ignored. Network errors, review-service 401/403/429/5xx responses, GitHub rate limits, timeouts, model failures, and callback failures never become `rejected`.

## Migration and runtime requirements

- Migration: `packages/worker/migrations/0004_reliable_review_pipeline.sql`
- Cron requirement: `*/5 * * * *` for the D1 outbox drain; the existing `0 17 * * *` metadata sync remains.
- Worker secrets remain dashboard-managed: `REVIEW_SERVICE_SECRET`, `JWT_SECRET`, and `GITHUB_CLIENT_SECRET`.
- Review VPS keeps `GITHUB_TOKEN`, `DEEPSEEK_API_KEY`, `WORKER_URL`, and `REVIEW_SERVICE_SECRET` outside the repository.
- The three historically exposed secrets were already rotated before this phase. No secret value is included here.
- The existing `seed-bot` account must be disabled manually in production. This PR only removes the hardcoded fallback password and makes non-dry-run execution fail closed.

## Deployment order

This PR does not run any of these commands or touch production.

1. Export/backup the production D1 database and record current Worker and VPS revisions.
2. Manually disable the current `seed-bot` account/process.
3. Deploy the review service first. It accepts both legacy and version-1 jobs; extra callback fields are ignored by the legacy Worker.
4. Apply migration `0004_reliable_review_pipeline.sql` after reviewing the export and row counts.
5. Deploy the Worker and verify health, one controlled submission, callback state, and the scheduled drain.
6. Do not replay the 111 historical rows. Run `scripts/reconcile-ledger` only in report mode when evidence is needed.

## Rollback

1. Stop new submission traffic and preserve a fresh D1 export.
2. Roll the Worker back. The new table keeps defaults compatible with legacy inserts; those rows receive no `next_attempt_at` and are not auto-dispatched.
3. Roll the review service back after the Worker.
4. If a full schema rollback is required, use the retained `submissions_legacy_phase1` table only from a reviewed maintenance-window migration. Do not drop the Phase 1 table; retain it for reconciliation.
5. Never use rollback as a reason to bulk replay ledger rows.
