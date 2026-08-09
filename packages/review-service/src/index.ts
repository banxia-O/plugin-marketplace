import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { ReviewJobPayload } from '@ppx/shared';
import { loadEnv, reviewSecretsMatch } from './env.js';
import { runPipeline } from './pipeline.js';

const env = loadEnv();

const app = new Hono();
const inFlight = new Map<string, Promise<void>>();
const recentlyCompleted = new Map<string, number>();
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;

function deliveryKey(job: ReviewJobPayload): string {
  return `${job.idempotencyKey}:${job.deliveryAttempt}`;
}

function normalizeJob(value: unknown): ReviewJobPayload | null {
  const job = value as Partial<ReviewJobPayload>;
  if (!job || typeof job.submissionId !== 'number' || !job.repoUrl || !job.name || !job.oneLiner) return null;
  if (job.payloadVersion !== undefined && job.payloadVersion !== 1) return null;
  if (!Array.isArray(job.subcategoryIds) || typeof job.uploaderUserId !== 'number' || !job.deployMethod) return null;
  return {
    payloadVersion: 1,
    idempotencyKey: job.idempotencyKey || `legacy:${job.submissionId}`,
    deliveryAttempt: job.deliveryAttempt && job.deliveryAttempt > 0 ? job.deliveryAttempt : 1,
    submissionId: job.submissionId,
    repoUrl: job.repoUrl,
    name: job.name,
    oneLiner: job.oneLiner,
    subcategoryIds: job.subcategoryIds,
    deployMethod: job.deployMethod,
    originalAuthor: job.originalAuthor ?? '',
    uploaderUserId: job.uploaderUserId,
  };
}

function startReview(job: ReviewJobPayload): boolean {
  const key = deliveryKey(job);
  const completedAt = recentlyCompleted.get(key);
  if (inFlight.has(key) || (completedAt !== undefined && Date.now() - completedAt < COMPLETED_TTL_MS)) return false;

  const task = runPipeline(env, job)
    .then(() => {
      recentlyCompleted.set(key, Date.now());
    })
    .catch((error) => {
      console.error(`[server] pipeline #${job.submissionId} 未捕获异常:`, error instanceof Error ? error.message : 'unknown');
    })
    .finally(() => {
      inFlight.delete(key);
      if (recentlyCompleted.size > 10_000) {
        const cutoff = Date.now() - COMPLETED_TTL_MS;
        for (const [completedKey, time] of recentlyCompleted) if (time < cutoff) recentlyCompleted.delete(completedKey);
      }
    });
  inFlight.set(key, task);
  return true;
}

app.get('/health', (c) => c.json({ status: 'ok' }));

/**
 * POST /review — Worker 调用，提交一个审核任务。
 * 立即返回 202，异步跑完整管线后回写 Worker admin 接口。
 */
app.post('/review', async (c) => {
  if (!reviewSecretsMatch(env.REVIEW_SERVICE_SECRET, c.req.header('x-review-secret'))) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const job = normalizeJob(await c.req.json().catch(() => null));
  if (!job) {
    return c.json({ error: 'bad_request', message: '缺少必填字段' }, 400);
  }

  const accepted = startReview(job);

  return c.json({ status: accepted ? 'accepted' : 'duplicate', submissionId: job.submissionId }, 202);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`review-service 启动：http://localhost:${info.port}`);
});
