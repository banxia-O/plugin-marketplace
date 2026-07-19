import { describe, expect, it } from 'vitest';
import { createSubmissionIdempotencyKey, persistIdempotentSubmission } from '../src/submission-service.js';

describe('submission idempotency', () => {
  it('normalizes equivalent GitHub URLs into the same key', async () => {
    const input = {
      repoUrl: 'https://GitHub.com/OpenAI/example.git/',
      name: 'Example',
      oneLiner: 'Example plugin',
      subcategoryIds: [2, 1],
      deployMethod: 'remote' as const,
      originalAuthor: '',
    };
    const first = await createSubmissionIdempotencyKey(7, input);
    const second = await createSubmissionIdempotencyKey(7, {
      ...input,
      repoUrl: 'https://github.com/openai/example',
      subcategoryIds: [1, 2],
    });
    expect(first).toBe(second);
  });

  it('returns the original row for a duplicate request', async () => {
    const rows = new Map<string, { id: number; status: string }>();
    const repository = {
      async insertOrGet(key: string) {
        const existing = rows.get(key);
        if (existing) return { submission: existing, created: false };
        const submission = { id: 41, status: 'queued' };
        rows.set(key, submission);
        return { submission, created: true };
      },
    };

    const first = await persistIdempotentSubmission(repository, 'same-key');
    const duplicate = await persistIdempotentSubmission(repository, 'same-key');
    expect(first).toEqual({ submission: { id: 41, status: 'queued' }, created: true });
    expect(duplicate).toEqual({ submission: { id: 41, status: 'queued' }, created: false });
  });
});
