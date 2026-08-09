import { Hono } from 'hono';
import { ReviewResultPayload, SubmissionRequest } from '@ppx/shared';
import type { AppContext } from './env.js';
import { authMiddleware } from './auth.js';
import {
  ActiveSubmissionConflictError,
  completeSubmissionWithPlugin,
  findSubmissionById,
  IdempotencyConflictError,
  insertSubmission,
  isPublishedRepo,
  transitionSubmissionStatus,
} from './db.js';
import { createD1DispatchRepository, dispatchReviewJob } from './dispatch.js';
import { planReviewCallback } from './review-callback.js';
import { configuredSecret, secretsMatch } from './runtime-secrets.js';
import {
  createSubmissionIdempotencyKey,
  scopeClientIdempotencyKey,
  toStoredReviewJob,
} from './submission-service.js';

export const submissionRoutes = new Hono<AppContext>();

async function persistCallbackTransition(
  db: D1Database,
  submissionId: number,
  from: Parameters<typeof transitionSubmissionStatus>[2],
  to: Parameters<typeof transitionSubmissionStatus>[3],
  callbackAttempt: number,
  input: Parameters<typeof transitionSubmissionStatus>[4],
): Promise<boolean> {
  const changed = await transitionSubmissionStatus(db, submissionId, from, to, {
    ...input,
    callbackAttempt,
  });
  if (changed) return false;
  const current = await findSubmissionById(db, submissionId);
  if (current?.status === to && (current.last_callback_attempt ?? 0) >= callbackAttempt) return true;
  throw new Error(`Submission callback state conflict: submission=${submissionId} attempt=${callbackAttempt}`);
}

/** POST /api/submissions — 登录用户提交插件上架申请 */
submissionRoutes.post('/', authMiddleware, async (c) => {
  const reviewServiceUrl = configuredSecret(c.env.REVIEW_SERVICE_URL);
  const reviewSecret = configuredSecret(c.env.REVIEW_SERVICE_SECRET);
  if (!reviewServiceUrl || !reviewSecret) {
    return c.json({ error: 'not_configured', message: '审核服务暂不可用' }, 503);
  }
  const parsed = SubmissionRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: parsed.error.issues[0]?.message ?? '提交信息不合法' }, 400);
  }
  const { repoUrl, name, oneLiner, subcategoryIds, deployMethod, originalAuthor } = parsed.data;
  const uploaderUserId = c.get('userId');
  const clientKey = c.req.header('idempotency-key')?.trim();
  const idempotencyKey = clientKey
    ? await scopeClientIdempotencyKey(uploaderUserId, clientKey)
    : await createSubmissionIdempotencyKey(uploaderUserId, parsed.data);

  const payload = toStoredReviewJob(
    { repoUrl, name, oneLiner, subcategoryIds, deployMethod, originalAuthor },
    uploaderUserId,
    idempotencyKey,
  );
  if (await isPublishedRepo(c.env.DB, payload.repoUrl)) {
    return c.json({ error: 'conflict', message: '该仓库已在平台上架或正在审核中' }, 409);
  }

  let result;
  try {
    result = await insertSubmission(c.env.DB, {
      repoUrl: payload.repoUrl,
      uploaderUserId,
      idempotencyKey,
      payload,
      correlationId: c.req.header('x-correlation-id'),
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return c.json({ error: 'idempotency_conflict', message: error.message }, 409);
    }
    if (error instanceof ActiveSubmissionConflictError) {
      return c.json({ error: 'conflict', message: error.message }, 409);
    }
    throw error;
  }
  const submissionId = result.submission.id;

  if (!result.created) {
    return c.json({ submissionId, status: result.submission.status, deduplicated: true }, 202);
  }

  const execCtx = c.executionCtx;
  if (typeof execCtx?.waitUntil === 'function') {
    execCtx.waitUntil(
      dispatchReviewJob(submissionId, {
        repository: createD1DispatchRepository(c.env.DB),
        reviewServiceUrl,
        reviewSecret,
      }).catch((error) => console.error('[submissions] dispatch failed', { submissionId, error: error instanceof Error ? error.message : 'unknown' })),
    );
  }

  return c.json({ submissionId, status: result.submission.status, deduplicated: !result.created }, 202);
});

/** GET /api/submissions/:id — 查询自己的提交状态 */
submissionRoutes.get('/:id', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'bad_request', message: '无效的提交 ID' }, 400);
  }
  const sub = await findSubmissionById(c.env.DB, id);
  if (!sub) return c.json({ error: 'not_found', message: '提交记录不存在' }, 404);
  if (sub.uploader_user_id !== c.get('userId')) {
    return c.json({ error: 'forbidden', message: '无权查看此提交记录' }, 403);
  }
  return c.json({
    submission: {
      id: sub.id,
      repoUrl: sub.repo_url,
      status: sub.status,
      rejectReason: sub.reject_reason,
      createdAt: sub.created_at,
    },
  });
});

export const adminRoutes = new Hono<AppContext>();

/** POST /api/admin/review-result — 审核服务回写（用 x-review-secret 鉴权） */
adminRoutes.post('/review-result', async (c) => {
  if (!(await secretsMatch(c.env.REVIEW_SERVICE_SECRET, c.req.header('x-review-secret')))) {
    return c.json({ error: 'unauthorized', message: '无效的审核密钥' }, 401);
  }

  const parsed = ReviewResultPayload.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: '结果格式不合法' }, 400);
  }
  const result = parsed.data;

  const submission = await findSubmissionById(c.env.DB, result.submissionId);
  if (!submission) return c.json({ error: 'not_found', message: '提交记录不存在' }, 404);

  const decision = planReviewCallback(
    {
      status: submission.status,
      attemptCount: submission.attempt_count,
      maxAttempts: submission.max_attempts,
      lastCallbackAttempt: submission.last_callback_attempt,
    },
    {
      status: result.status,
      deliveryAttempt: result.deliveryAttempt,
      retryable: result.status === 'failed' ? result.retryable : undefined,
      retryAfterMs: result.status === 'failed' ? result.retryAfterMs : undefined,
    },
  );
  if (decision.action === 'ignore') {
    return c.json({ ok: true, deduplicated: true, reason: decision.reason });
  }

  if (result.status === 'done') {
    const completion = await completeSubmissionWithPlugin(c.env.DB, submission, result.plugin, result.deliveryAttempt);
    return c.json({ ok: true, deduplicated: completion.deduplicated });
  }

  if (result.status === 'rejected') {
    const deduplicated = await persistCallbackTransition(
      c.env.DB,
      result.submissionId,
      submission.status,
      'rejected',
      result.deliveryAttempt,
      {
        rejectReason: result.rejectReason,
        errorCode: result.reasonCode,
      },
    );
    return c.json({ ok: true, deduplicated });
  }

  const deduplicated = await persistCallbackTransition(
    c.env.DB,
    result.submissionId,
    submission.status,
    decision.status,
    result.deliveryAttempt,
    {
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      nextAttemptAt: decision.status === 'retry_wait' && 'nextAttemptAt' in decision ? decision.nextAttemptAt : null,
    },
  );
  return c.json({ ok: true, deduplicated });
});
