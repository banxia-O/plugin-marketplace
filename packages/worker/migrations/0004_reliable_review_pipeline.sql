-- Phase 1 durable D1 outbox. The legacy table is retained for a data-preserving rollback.
ALTER TABLE submissions RENAME TO submissions_legacy_phase1;
DROP INDEX IF EXISTS idx_submissions_status;

CREATE TABLE submissions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_url              TEXT    NOT NULL,
  uploader_user_id      INTEGER REFERENCES users(id),
  status                TEXT    NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','dispatching','processing','retry_wait','done','rejected','failed','dead_letter')),
  reject_reason         TEXT,
  payload_version       INTEGER NOT NULL DEFAULT 0,
  job_payload_json      TEXT    NOT NULL DEFAULT '{"payloadVersion":0}',
  attempt_count         INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts          INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error_code       TEXT,
  last_error_message    TEXT,
  idempotency_key       TEXT    UNIQUE,
  next_attempt_at       TEXT,
  processing_started_at TEXT,
  completed_at          TEXT,
  correlation_id        TEXT,
  last_callback_attempt INTEGER,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO submissions (
  id, repo_url, uploader_user_id, status, reject_reason, payload_version,
  job_payload_json, attempt_count, max_attempts, idempotency_key,
  next_attempt_at, completed_at, created_at, updated_at
)
SELECT
  id, repo_url, uploader_user_id, status, reject_reason, 0,
  '{"payloadVersion":0}', 0, 5, 'legacy:' || id,
  NULL,
  CASE WHEN status IN ('done','rejected') THEN created_at ELSE NULL END,
  created_at, created_at
FROM submissions_legacy_phase1;

CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_due ON submissions(status, next_attempt_at);
CREATE INDEX idx_submissions_repo ON submissions(repo_url);
