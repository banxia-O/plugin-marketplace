import { Hono } from 'hono';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  GITHUB_CLIENT_ID: string;
  JWT_SECRET: string;
  GITHUB_CLIENT_SECRET: string;
  REVIEW_SERVICE_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
