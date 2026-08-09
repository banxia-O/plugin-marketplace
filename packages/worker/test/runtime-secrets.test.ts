import { afterEach, describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import worker from '../src/index.js';
import type { Env } from '../src/env.js';

const JWT_SECRET = 'runtime-test-jwt-secret';

function testEnv(overrides: Partial<Env> = {}): { env: Env; prepare: ReturnType<typeof vi.fn>; cacheGet: ReturnType<typeof vi.fn> } {
  const prepare = vi.fn();
  const cacheGet = vi.fn();
  const env: Env = {
    DB: { prepare } as unknown as D1Database,
    CACHE: {
      get: cacheGet,
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as KVNamespace,
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    JWT_SECRET,
    REVIEW_SERVICE_URL: 'https://review.example',
    REVIEW_SERVICE_SECRET: 'review-service-secret',
    ...overrides,
  };
  return { env, prepare, cacheGet };
}

async function postReviewResult(env: Env, secret?: string): Promise<Response> {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (secret !== undefined) headers.set('x-review-secret', secret);
  return worker.fetch(new Request('https://worker.example/api/admin/review-result', {
    method: 'POST',
    headers,
    body: '{}',
  }), env, {} as ExecutionContext);
}

afterEach(() => vi.unstubAllGlobals());

describe('runtime secret guards', () => {
  it.each([
    ['missing configuration', undefined, undefined],
    ['empty configuration', '', undefined],
    ['blank configuration', '   ', undefined],
    ['missing header', 'review-service-secret', undefined],
    ['wrong header', 'review-service-secret', 'wrong-secret'],
  ])('rejects review callbacks with %s', async (_label, configured, provided) => {
    const { env, prepare } = testEnv({ REVIEW_SERVICE_SECRET: configured });
    const response = await postReviewResult(env, provided);
    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('allows the correct review secret to reach payload validation', async () => {
    const { env, prepare } = testEnv();
    const response = await postReviewResult(env, 'review-service-secret');
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 503 before GitHub token exchange when OAuth secrets are missing', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const { env, cacheGet } = testEnv({ GITHUB_CLIENT_SECRET: undefined });

    const response = await worker.fetch(
      new Request('https://worker.example/api/auth/github/callback?code=code&state=state'),
      env,
      {} as ExecutionContext,
    );

    expect(response.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
    expect(cacheGet).not.toHaveBeenCalled();
  });

  it.each(['/api/auth/register', '/api/auth/login'])('returns 503 without JWT_SECRET at %s', async (path) => {
    const { env, prepare } = testEnv({ JWT_SECRET: undefined });
    const body = path.endsWith('register')
      ? { username: 'tester', password: 'password123' }
      : { identifier: 'tester', password: 'password123' };
    const response = await worker.fetch(new Request(`https://worker.example${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), env, {} as ExecutionContext);

    expect(response.status).toBe(503);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 503 before Bearer verification when JWT_SECRET is missing', async () => {
    const { env, prepare } = testEnv({ JWT_SECRET: undefined });
    const response = await worker.fetch(new Request('https://worker.example/api/me', {
      headers: { authorization: 'Bearer unusable-token' },
    }), env, {} as ExecutionContext);

    expect(response.status).toBe(503);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 503 before inserting a submission when review configuration is missing', async () => {
    const { env, prepare } = testEnv({ REVIEW_SERVICE_SECRET: undefined });
    const token = await sign({ sub: 1, exp: Math.floor(Date.now() / 1000) + 60 }, JWT_SECRET);
    const response = await worker.fetch(new Request('https://worker.example/api/submissions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repoUrl: 'https://github.com/example/plugin',
        name: 'Example',
        oneLiner: 'Example plugin',
        subcategoryIds: [1],
        deployMethod: 'remote',
      }),
    }), env, {} as ExecutionContext);

    expect(response.status).toBe(503);
    expect(prepare).not.toHaveBeenCalled();
  });
});
