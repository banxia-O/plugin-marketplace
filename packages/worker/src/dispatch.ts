import type { ReviewJobPayload, StoredReviewJobPayload } from '@ppx/shared';
import { assertSubmissionTransition } from './submission-state.js';
import type { SubmissionStatus } from './submission-state.js';
import { calculateRetryDelayMs } from './retry-policy.js';
import { configuredSecret } from './runtime-secrets.js';

export { calculateRetryDelayMs } from './retry-policy.js';

const DISPATCH_LEASE_MINUTES = 2;
const PROCESSING_LEASE_MINUTES = 15;

export interface DispatchSubmission {
  id: number;
  status: SubmissionStatus;
  attemptCount: number;
  maxAttempts: number;
  payload: StoredReviewJobPayload;
}

export interface DispatchRepository {
  claim(id: number): Promise<DispatchSubmission | null>;
  markProcessing(id: number, attempt: number): Promise<void>;
  markRetry(id: number, attempt: number, code: string, message: string, nextAttemptAt: string): Promise<void>;
  markFailed(id: number, attempt: number, status: 'failed' | 'dead_letter', code: string, message: string): Promise<void>;
}

function sanitizeMessage(value: string): string {
  return value
    .replace(/\b(authorization|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function classifyDispatchResponse(response: Response): { retryable: boolean; code: string } {
  if (response.status === 401) return { retryable: true, code: 'review_auth_error' };
  if (response.status === 403 || response.status === 429) return { retryable: true, code: 'review_rate_limit' };
  if (response.status >= 500) return { retryable: true, code: 'review_server_error' };
  return { retryable: false, code: 'review_bad_response' };
}

export interface DispatchDependencies {
  repository: DispatchRepository;
  send?: typeof fetch;
  reviewServiceUrl?: string;
  reviewSecret?: string;
  now?: () => number;
  random?: () => number;
}

export async function dispatchReviewJob(id: number, dependencies: DispatchDependencies): Promise<void> {
  const reviewServiceUrl = configuredSecret(dependencies.reviewServiceUrl);
  const reviewSecret = configuredSecret(dependencies.reviewSecret);
  if (!reviewServiceUrl || !reviewSecret) return;

  const claimed = await dependencies.repository.claim(id);
  if (!claimed) return;

  const job: ReviewJobPayload = {
    ...claimed.payload,
    submissionId: claimed.id,
    deliveryAttempt: claimed.attemptCount,
  };

  let response: Response;
  try {
    response = await (dependencies.send ?? fetch)(`${reviewServiceUrl}/review`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-review-secret': reviewSecret,
        'idempotency-key': `${job.idempotencyKey}:${job.deliveryAttempt}`,
      },
      body: JSON.stringify(job),
    });
  } catch (error) {
    await handleDispatchFailure(claimed, dependencies, 'review_network_error', error instanceof Error ? error.message : 'network error');
    return;
  }

  if (response.ok) {
    await dependencies.repository.markProcessing(claimed.id, claimed.attemptCount);
    return;
  }

  const classification = classifyDispatchResponse(response);
  const body = sanitizeMessage(await response.text().catch(() => ''));
  if (!classification.retryable) {
    await dependencies.repository.markFailed(claimed.id, claimed.attemptCount, 'failed', classification.code, `HTTP ${response.status}: ${body}`);
    return;
  }
  await handleDispatchFailure(
    claimed,
    dependencies,
    classification.code,
    `HTTP ${response.status}: ${body}`,
    response.headers,
  );
}

async function handleDispatchFailure(
  claimed: DispatchSubmission,
  dependencies: DispatchDependencies,
  code: string,
  message: string,
  headers?: Headers,
): Promise<void> {
  const cleanMessage = sanitizeMessage(message);
  if (claimed.attemptCount >= claimed.maxAttempts) {
    await dependencies.repository.markFailed(claimed.id, claimed.attemptCount, 'dead_letter', code, cleanMessage);
    return;
  }
  const nowMs = (dependencies.now ?? Date.now)();
  const delay = calculateRetryDelayMs({
    attempt: claimed.attemptCount,
    retryAfter: headers?.get('retry-after'),
    rateLimitReset: headers?.get('x-ratelimit-reset'),
    nowMs,
    random: dependencies.random,
  });
  await dependencies.repository.markRetry(
    claimed.id,
    claimed.attemptCount,
    code,
    cleanMessage,
    new Date(nowMs + delay).toISOString(),
  );
}

interface DispatchRow {
  id: number;
  status: SubmissionStatus;
  attempt_count: number;
  max_attempts: number;
  job_payload_json: string;
  next_attempt_at: string | null;
}

function requireSingleChange(changes: number | undefined, operation: string, id: number, attempt: number): void {
  if ((changes ?? 0) !== 1) throw new Error(`Dispatch state conflict during ${operation}: submission=${id} attempt=${attempt}`);
}

function parseStoredPayload(value: string): StoredReviewJobPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<StoredReviewJobPayload>;
    if (
      payload.payloadVersion !== 1 ||
      !payload.idempotencyKey ||
      !payload.repoUrl ||
      !payload.name ||
      !payload.oneLiner ||
      !Array.isArray(payload.subcategoryIds) ||
      typeof payload.uploaderUserId !== 'number'
    ) return null;
    return payload as StoredReviewJobPayload;
  } catch {
    return null;
  }
}

export function createD1DispatchRepository(db: D1Database): DispatchRepository {
  return {
    async claim(id) {
      const current = await db.prepare('SELECT id, status, attempt_count, max_attempts, job_payload_json, next_attempt_at FROM submissions WHERE id = ?').bind(id).first<DispatchRow>();
      if (!current || !['queued', 'retry_wait', 'processing', 'dispatching'].includes(current.status)) return null;
      const payload = parseStoredPayload(current.job_payload_json);
      if (!payload) {
        assertSubmissionTransition(current.status, 'failed');
        await db
          .prepare("UPDATE submissions SET status = 'failed', active_repo_key = NULL, last_error_code = 'invalid_job_payload', last_error_message = 'Stored review payload is invalid', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = ?")
          .bind(id, current.status)
          .run();
        return null;
      }
      assertSubmissionTransition(current.status, 'dispatching');
      const result = await db
        .prepare(`UPDATE submissions SET status = 'dispatching', attempt_count = attempt_count + 1, next_attempt_at = datetime('now', '+${DISPATCH_LEASE_MINUTES} minutes'), updated_at = datetime('now')
          WHERE id = ? AND status = ? AND attempt_count = ? AND attempt_count < max_attempts
            AND next_attempt_at IS NOT NULL AND datetime(next_attempt_at) <= datetime('now')`)
        .bind(id, current.status, current.attempt_count)
        .run();
      if ((result.meta.changes ?? 0) !== 1) return null;
      return {
        id: current.id,
        status: 'dispatching',
        attemptCount: current.attempt_count + 1,
        maxAttempts: current.max_attempts,
        payload,
      };
    },
    async markProcessing(id, attempt) {
      assertSubmissionTransition('dispatching', 'processing');
      const result = await db
        .prepare(`UPDATE submissions SET status = 'processing', processing_started_at = datetime('now'), next_attempt_at = datetime('now', '+${PROCESSING_LEASE_MINUTES} minutes'), updated_at = datetime('now') WHERE id = ? AND status = 'dispatching' AND attempt_count = ?`)
        .bind(id, attempt)
        .run();
      requireSingleChange(result.meta.changes, 'markProcessing', id, attempt);
    },
    async markRetry(id, attempt, code, message, nextAttemptAt) {
      assertSubmissionTransition('dispatching', 'retry_wait');
      const result = await db
        .prepare("UPDATE submissions SET status = 'retry_wait', last_error_code = ?, last_error_message = ?, next_attempt_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'dispatching' AND attempt_count = ?")
        .bind(code, message, nextAttemptAt, id, attempt)
        .run();
      requireSingleChange(result.meta.changes, 'markRetry', id, attempt);
    },
    async markFailed(id, attempt, status, code, message) {
      assertSubmissionTransition('dispatching', status);
      const result = await db
        .prepare("UPDATE submissions SET status = ?, active_repo_key = NULL, last_error_code = ?, last_error_message = ?, next_attempt_at = NULL, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'dispatching' AND attempt_count = ?")
        .bind(status, code, message, id, attempt)
        .run();
      requireSingleChange(result.meta.changes, 'markFailed', id, attempt);
    },
  };
}

export async function dispatchDueReviews(
  db: D1Database,
  config: Omit<DispatchDependencies, 'repository'>,
  limit = 20,
): Promise<void> {
  if (!configuredSecret(config.reviewServiceUrl) || !configuredSecret(config.reviewSecret)) return;

  const due = (
    await db
      .prepare(`SELECT id FROM submissions
        WHERE status IN ('queued', 'retry_wait', 'processing', 'dispatching')
          AND next_attempt_at IS NOT NULL
          AND datetime(next_attempt_at) <= datetime('now')
          AND attempt_count < max_attempts
        ORDER BY next_attempt_at, id LIMIT ?`)
      .bind(limit)
      .all<{ id: number }>()
  ).results;
  const repository = createD1DispatchRepository(db);
  for (const row of due) {
    try {
      await dispatchReviewJob(row.id, { ...config, repository });
    } catch (error) {
      console.error('[dispatch] unexpected job error', {
        submissionId: row.id,
        message: sanitizeMessage(error instanceof Error ? error.message : 'unknown'),
      });
    }
  }

  const exhausted = (
    await db
      .prepare(`SELECT id, status FROM submissions WHERE status IN ('retry_wait', 'processing', 'dispatching') AND attempt_count >= max_attempts AND next_attempt_at IS NOT NULL AND datetime(next_attempt_at) <= datetime('now')`)
      .all<{ id: number; status: SubmissionStatus }>()
  ).results;
  for (const row of exhausted) {
    assertSubmissionTransition(row.status, 'dead_letter');
    await db
      .prepare("UPDATE submissions SET status = 'dead_letter', active_repo_key = NULL, next_attempt_at = NULL, last_error_code = COALESCE(last_error_code, 'max_attempts_exhausted'), completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = ?")
      .bind(row.id, row.status)
      .run();
  }
}
