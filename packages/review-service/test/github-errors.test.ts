import { afterEach, describe, expect, it, vi } from 'vitest';
import { securityScan } from '../src/deepseek.js';
import { classifyGithubResponse, toReviewError } from '../src/errors.js';

afterEach(() => vi.unstubAllGlobals());

describe('GitHub error classification', () => {
  it.each([
    [404, {}, 'github_not_found', false],
    [401, {}, 'github_auth_error', true],
    [403, { 'x-ratelimit-remaining': '0' }, 'github_primary_rate_limit', true],
    [429, { 'retry-after': '30' }, 'github_secondary_rate_limit', true],
    [503, {}, 'github_server_error', true],
  ] as const)('classifies HTTP %s', (status, headers, code, retryable) => {
    const error = classifyGithubResponse(new Response('', { status, headers }));
    expect(error).toMatchObject({ code, retryable });
  });

  it('classifies timeouts without turning them into business rejection', () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    expect(toReviewError(timeout)).toMatchObject({ code: 'github_timeout', retryable: true, kind: 'technical' });
  });

  it('classifies DeepSeek failures as retryable model errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(securityScan('placeholder', 'Example', '# Readme', '{}')).rejects.toMatchObject({
      code: 'model_error',
      retryable: true,
      kind: 'technical',
    });
  });
});
