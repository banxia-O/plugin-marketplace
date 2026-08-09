import { afterEach, describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import worker from '../src/index.js';
import type { Env } from '../src/env.js';
import { createMigratedTestD1 } from './helpers/d1.js';

const disposers: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(disposers.splice(0).map((dispose) => dispose())));

const JWT_SECRET = 'route-test-secret';

function requestBody(name = 'Plugin') {
  return {
    repoUrl: 'https://github.com/example/route-plugin',
    name,
    oneLiner: 'Route conflict test',
    subcategoryIds: [1],
    deployMethod: 'remote',
    originalAuthor: 'example',
  };
}

async function postSubmission(db: D1Database, clientKey: string, name = 'Plugin'): Promise<Response> {
  const token = await sign({ sub: 1, exp: Math.floor(Date.now() / 1000) + 60 }, JWT_SECRET);
  const env = {
    DB: db,
    CACHE: {} as KVNamespace,
    GITHUB_CLIENT_ID: '',
    JWT_SECRET,
    GITHUB_CLIENT_SECRET: '',
    REVIEW_SERVICE_SECRET: 'review-test-secret',
    REVIEW_SERVICE_URL: 'https://review.example',
  } satisfies Env;
  return worker.fetch(new Request('https://worker.example/api/submissions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': clientKey,
    },
    body: JSON.stringify(requestBody(name)),
  }), env, {} as ExecutionContext);
}

describe('submission conflict responses', () => {
  it('returns 409 when a different idempotency key targets an active repository', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    expect((await postSubmission(testD1.db, 'first')).status).toBe(202);
    const conflict = await postSubmission(testD1.db, 'second');
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: 'conflict' });
  });

  it('returns 409 when an idempotency key is reused for a different payload', async () => {
    const testD1 = await createMigratedTestD1();
    disposers.push(testD1.dispose);
    expect((await postSubmission(testD1.db, 'same', 'Original')).status).toBe(202);
    const conflict = await postSubmission(testD1.db, 'same', 'Changed');
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ error: 'idempotency_conflict' });
  });
});
