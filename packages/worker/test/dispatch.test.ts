import { describe, expect, it, vi } from 'vitest';
import { calculateRetryDelayMs, dispatchReviewJob } from '../src/dispatch.js';
import type { DispatchRepository, DispatchSubmission } from '../src/dispatch.js';

function fakeRepository(maxAttempts = 3): { repository: DispatchRepository; row: DispatchSubmission } {
  const row: DispatchSubmission = {
    id: 9,
    status: 'queued',
    attemptCount: 0,
    maxAttempts,
    payload: {
      payloadVersion: 1,
      idempotencyKey: 'job-key',
      repoUrl: 'https://github.com/openai/example',
      name: 'Example',
      oneLiner: 'Example plugin',
      subcategoryIds: [1],
      deployMethod: 'remote',
      originalAuthor: '',
      uploaderUserId: 2,
    },
  };
  const repository: DispatchRepository = {
    async claim() {
      if (!['queued', 'retry_wait', 'processing'].includes(row.status)) return null;
      row.status = 'dispatching';
      row.attemptCount += 1;
      return { ...row };
    },
    async markProcessing() {
      row.status = 'processing';
    },
    async markRetry() {
      row.status = 'retry_wait';
    },
    async markFailed(_id, _attempt, status) {
      row.status = status;
    },
  };
  return { repository, row };
}

describe('review dispatch', () => {
  it('redelivers a retryable failed request', async () => {
    const { repository, row } = fakeRepository();
    const send = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 202 }));

    await dispatchReviewJob(9, { repository, send, reviewServiceUrl: 'https://review.example', reviewSecret: 'test' });
    expect(row.status).toBe('retry_wait');
    await dispatchReviewJob(9, { repository, send, reviewServiceUrl: 'https://review.example', reviewSecret: 'test' });
    expect(row.status).toBe('processing');
    expect(row.attemptCount).toBe(2);
  });

  it('moves to dead letter after max attempts', async () => {
    const { repository, row } = fakeRepository(1);
    await dispatchReviewJob(9, {
      repository,
      send: vi.fn().mockResolvedValue(new Response('busy', { status: 503 })),
      reviewServiceUrl: 'https://review.example',
      reviewSecret: 'test',
    });
    expect(row.status).toBe('dead_letter');
  });

  it('honors Retry-After and otherwise uses bounded exponential jitter', () => {
    const hinted = calculateRetryDelayMs({ attempt: 2, retryAfter: '120', nowMs: 0, random: () => 0.5 });
    expect(hinted).toBeGreaterThanOrEqual(120_000);
    const delay = calculateRetryDelayMs({ attempt: 3, nowMs: 0, random: () => 0.5 });
    expect(delay).toBeGreaterThanOrEqual(20_000);
    expect(delay).toBeLessThanOrEqual(40_000);
  });
});
