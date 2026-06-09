import { Hono } from 'hono';
import { ReviewResultPayload, SubmissionRequest } from '@ppx/shared';
import type { ReviewJobPayload } from '@ppx/shared';
import type { AppContext } from './env.js';
import { authMiddleware } from './auth.js';
import {
  findSubmissionById,
  insertPluginFromReview,
  insertSubmission,
  isDuplicateRepo,
  updateSubmissionStatus,
} from './db.js';

export const submissionRoutes = new Hono<AppContext>();

/** POST /api/submissions — 登录用户提交插件上架申请 */
submissionRoutes.post('/', authMiddleware, async (c) => {
  const parsed = SubmissionRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: parsed.error.issues[0]?.message ?? '提交信息不合法' }, 400);
  }
  const { repoUrl, name, oneLiner, subcategoryIds, deployMethod, originalAuthor } = parsed.data;
  const uploaderUserId = c.get('userId');

  if (await isDuplicateRepo(c.env.DB, repoUrl)) {
    return c.json({ error: 'conflict', message: '该仓库已在平台上架或正在审核中' }, 409);
  }

  const { id: submissionId } = await insertSubmission(c.env.DB, { repoUrl, uploaderUserId });

  if (c.env.REVIEW_SERVICE_URL) {
    const job: ReviewJobPayload = {
      submissionId,
      repoUrl,
      name,
      oneLiner,
      subcategoryIds,
      deployMethod,
      originalAuthor: originalAuthor ?? '',
      uploaderUserId,
    };
    const execCtx = c.executionCtx;
    execCtx?.waitUntil(
      fetch(`${c.env.REVIEW_SERVICE_URL}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-review-secret': c.env.REVIEW_SERVICE_SECRET },
        body: JSON.stringify(job),
      }).catch((err) => console.error('[submissions] review service unreachable:', err)),
    );
  }

  return c.json({ submissionId, status: 'queued' }, 202);
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

  if (result.status === 'rejected') {
    await updateSubmissionStatus(c.env.DB, result.submissionId, 'rejected', result.rejectReason);
    return c.json({ ok: true });
  }

  try {
    await insertPluginFromReview(c.env.DB, result.plugin);
    await updateSubmissionStatus(c.env.DB, result.submissionId, 'done');
  } catch {
    await updateSubmissionStatus(c.env.DB, result.submissionId, 'rejected', '插件入库失败（可能存在重复数据）');
  }
  return c.json({ ok: true });
});
