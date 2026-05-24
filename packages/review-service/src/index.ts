import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { ReviewJobPayload } from '@ppx/shared';
import { loadEnv } from './env.js';
import { runPipeline } from './pipeline.js';

const env = loadEnv();

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

/**
 * POST /review — Worker 调用，提交一个审核任务。
 * 立即返回 202，异步跑完整管线后回写 Worker admin 接口。
 */
app.post('/review', async (c) => {
  if (c.req.header('x-review-secret') !== env.REVIEW_SERVICE_SECRET) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const job = (await c.req.json()) as ReviewJobPayload;
  if (!job.submissionId || !job.repoUrl) {
    return c.json({ error: 'bad_request', message: '缺少必填字段' }, 400);
  }

  // fire and forget — 管线异步运行
  runPipeline(env, job).catch((err) => {
    console.error(`[server] pipeline #${job.submissionId} 未捕获异常:`, err);
  });

  return c.json({ status: 'accepted', submissionId: job.submissionId }, 202);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`review-service 启动：http://localhost:${info.port}`);
});
