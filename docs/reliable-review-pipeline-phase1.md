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

All transitions are checked centrally. Dispatch claims use a two-minute lease, processing uses a fifteen-minute lease, and expired leases are reclaimable. Each delivery carries an attempt number, and duplicate or stale callbacks are ignored. Network errors, review-service 401/403/429/5xx responses, GitHub rate limits, timeouts, model failures, and callback failures never become `rejected`.

## Migration and runtime requirements

- Migration: `packages/worker/migrations/0004_reliable_review_pipeline.sql`
- Read-only preflight: `packages/worker/preflight/0004_active_repo_conflicts.sql`. The migration must not run while this query returns any row.
- Cron requirement: `*/5 * * * *` for the D1 outbox drain; the existing `0 17 * * *` metadata sync remains.
- Worker secrets remain dashboard-managed: `REVIEW_SERVICE_SECRET`, `JWT_SECRET`, and `GITHUB_CLIENT_SECRET`.
- Review VPS keeps `GITHUB_TOKEN`, `DEEPSEEK_API_KEY`, `WORKER_URL`, and `REVIEW_SERVICE_SECRET` outside the repository.
- The three historically exposed secrets were already rotated before this phase. No secret value is included here.
- The existing `seed-bot` account must be disabled manually in production. This PR only removes the hardcoded fallback password and makes non-dry-run execution fail closed.

## Deployment order

This PR does not run any of these commands or touch production.

The new review service can emit a `failed` callback that the legacy Worker rejects. The fixture test in `packages/review-service/test/callback-contract.test.ts` locks this incompatibility in place, so this is a maintenance-window rollout, not a zero-downtime rolling deploy.

1. Export/backup the production D1 database and record current Worker and VPS revisions.
2. Start a maintenance window: pause new submission ingress and every automatic review dispatch source, then wait for all legacy in-flight reviews and callbacks to drain.
3. Manually disable the current `seed-bot` account/process.
4. Run the read-only `0004_active_repo_conflicts.sql` preflight against production. Resolve and document every returned conflict before continuing; do not apply the migration while conflicts remain.
5. With submission traffic still paused, deploy the review service.
6. Apply migration `0004_reliable_review_pipeline.sql`, then deploy the Worker immediately afterward.
7. Verify Worker and review-service health, the callback contract, one controlled submission, callback state, and the scheduled drain. Resume submission traffic only after both sides are confirmed compatible.
8. Do not replay the 111 historical rows. Run `scripts/reconcile-ledger` only in report mode when evidence is needed.

## Rollback

1. Stop new submission traffic and every dispatch source, drain in-flight callbacks, and preserve a fresh D1 export.
2. Roll the Worker and review service back inside the same maintenance window. Do not allow a new review service to send `failed` callbacks to a legacy Worker.
3. Keep submission traffic paused until the two rolled-back components have passed their legacy callback checks.
4. If a full schema rollback is required, use the retained `submissions_legacy_phase1` table only from a reviewed maintenance-window migration. Do not drop the Phase 1 table; retain it for reconciliation.
5. Never use rollback as a reason to bulk replay ledger rows.
