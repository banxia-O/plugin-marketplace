import { Hono } from 'hono';
import { ReviewResultPayload, SubmissionRequest } from '@ppx/shared';
import type { AppContext } from './env.js';
import { authMiddleware } from './auth.js';
import {
  findSubmissionById,
  findSubmissionByIdempotencyKey,
  insertPluginFromReview,
  insertSubmission,
  isDuplicateRepo,
  transitionSubmissionStatus,
} from './db.js';
import { createD1DispatchRepository, dispatchReviewJob } from './dispatch.js';
import { decideCallbackTransition } from './submission-state.js';
import {
  createSubmissionIdempotencyKey,
  scopeClientIdempotencyKey,
  toStoredReviewJob,
} from './submission-service.js';

export const submissionRoutes = new Hono<AppContext>();

/** POST /api/submissions — 登录用户提交插件上架申请 */
submissionRoutes.post('/', authMiddleware, async (c) => {
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

  const existingRequest = await findSubmissionByIdempotencyKey(c.env.DB, idempotencyKey);
  if (existingRequest) {
    return c.json({ submissionId: existingRequest.id, status: existingRequest.status, deduplicated: true }, 202);
  }

  const payload = toStoredReviewJob(
    { repoUrl, name, oneLiner, subcategoryIds, deployMethod, originalAuthor },
    uploaderUserId,
    idempotencyKey,
  );
  if (await isDuplicateRepo(c.env.DB, payload.repoUrl)) {
    return c.json({ error: 'conflict', message: '该仓库已在平台上架或正在审核中' }, 409);
  }

  const result = await insertSubmission(c.env.DB, {
    repoUrl: payload.repoUrl,
    uploaderUserId,
    idempotencyKey,
    payload,
    correlationId: c.req.header('x-correlation-id'),
  });
  const submissionId = result.submission.id;

  if (c.env.REVIEW_SERVICE_URL) {
    const execCtx = c.executionCtx;
    execCtx?.waitUntil(
      dispatchReviewJob(submissionId, {
        repository: createD1DispatchRepository(c.env.DB),
        reviewServiceUrl: c.env.REVIEW_SERVICE_URL,
        reviewSecret: c.env.REVIEW_SERVICE_SECRET,
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
  if (c.req.header('x-review-secret') !== c.env.REVIEW_SERVICE_SECRET) {
    return c.json({ error: 'unauthorized', message: '无效的审核密钥' }, 401);
  }

  const parsed = ReviewResultPayload.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: '结果格式不合法' }, 400);
  }
  const result = parsed.data;

  const submission = await findSubmissionById(c.env.DB, result.submissionId);
  if (!submission) return c.json({ error: 'not_found', message: '提交记录不存在' }, 404);

  const decision = decideCallbackTransition(
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
    },
  );
  if (decision.action === 'ignore') {
    return c.json({ ok: true, deduplicated: true, reason: decision.reason });
  }

  if (result.status === 'done') {
    await insertPluginFromReview(c.env.DB, result.plugin);
    await transitionSubmissionStatus(c.env.DB, result.submissionId, submission.status, 'done', {
      callbackAttempt: result.deliveryAttempt,
    });
    return c.json({ ok: true });
  }

  if (result.status === 'rejected') {
    await transitionSubmissionStatus(c.env.DB, result.submissionId, submission.status, 'rejected', {
      rejectReason: result.rejectReason,
      errorCode: result.reasonCode,
      callbackAttempt: result.deliveryAttempt,
    });
    return c.json({ ok: true });
  }

  const retryDelay = Math.max(0, result.retryAfterMs ?? 30_000);
  await transitionSubmissionStatus(c.env.DB, result.submissionId, submission.status, decision.status, {
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    nextAttemptAt: decision.status === 'retry_wait' ? new Date(Date.now() + retryDelay).toISOString() : null,
    callbackAttempt: result.deliveryAttempt,
  });
  return c.json({ ok: true });
});
