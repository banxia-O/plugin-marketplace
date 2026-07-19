import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLicense, resolveRepoLicense } from '../src/github.js';

afterEach(() => vi.unstubAllGlobals());

const MIT_TEXT = `MIT License

Copyright (c) Example

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.`;

function contentResponse(content: string): Response {
  return new Response(JSON.stringify({ content: Buffer.from(content).toString('base64'), encoding: 'base64' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('LICENSE file fallback', () => {
  it('resolves MIT when the repository API has no SPDX license', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(contentResponse(MIT_TEXT)));
    await expect(resolveRepoLicense(null, 'example', 'plugin', 'placeholder')).resolves.toBe('MIT');
  });

  it('keeps a LICENSE 403 rate limit as a retryable technical error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) },
    })));
    await expect(resolveRepoLicense(null, 'example', 'plugin', 'placeholder')).rejects.toMatchObject({
      code: 'github_primary_rate_limit',
      retryable: true,
      kind: 'technical',
    });
  });

  it('keeps an unknown successful LICENSE read as a business rejection', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(contentResponse('Custom proprietary license text'))
      .mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const resolved = await resolveRepoLicense('NOASSERTION', 'example', 'plugin', 'placeholder');
    expect(resolved).toBeNull();
    expect(checkLicense(resolved)).toMatchObject({ allowed: false });
  });
});
