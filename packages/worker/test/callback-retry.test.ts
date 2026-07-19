import { describe, expect, it } from 'vitest';
import { planReviewCallback } from '../src/review-callback.js';

function failure(attempt: number, maxAttempts = 5, retryAfterMs?: number) {
  return planReviewCallback(
    { status: 'processing', attemptCount: attempt, maxAttempts, lastCallbackAttempt: null },
    { status: 'failed', deliveryAttempt: attempt, retryable: true, retryAfterMs },
    { nowMs: 1_000_000, random: () => 0.5 },
  );
}

describe('review callback retry policy', () => {
  it.each([
    [1, 10_000],
    [2, 20_000],
    [3, 40_000],
  ])('uses exponential backoff for callback attempt %s', (attempt, expectedDelay) => {
    const plan = failure(attempt);
    expect(plan).toMatchObject({ action: 'transition', status: 'retry_wait' });
    if (plan.action === 'transition') expect(Date.parse(plan.nextAttemptAt!)).toBe(1_000_000 + expectedDelay);
  });

  it('adds positive jitter without scheduling before a server hint', () => {
    const low = planReviewCallback(
      { status: 'processing', attemptCount: 2, maxAttempts: 5, lastCallbackAttempt: null },
      { status: 'failed', deliveryAttempt: 2, retryable: true, retryAfterMs: 120_000 },
      { nowMs: 1_000_000, random: () => 0 },
    );
    const high = planReviewCallback(
      { status: 'processing', attemptCount: 2, maxAttempts: 5, lastCallbackAttempt: null },
      { status: 'failed', deliveryAttempt: 2, retryable: true, retryAfterMs: 120_000 },
      { nowMs: 1_000_000, random: () => 1 },
    );
    if (low.action !== 'transition' || high.action !== 'transition') throw new Error('expected transition');
    expect(Date.parse(low.nextAttemptAt!)).toBeGreaterThanOrEqual(1_120_000);
    expect(Date.parse(high.nextAttemptAt!)).toBeGreaterThan(Date.parse(low.nextAttemptAt!));
  });

  it('caps exponential backoff and dead-letters at max attempts', () => {
    const capped = failure(30, 31);
    if (capped.action !== 'transition') throw new Error('expected transition');
    expect(Date.parse(capped.nextAttemptAt!) - 1_000_000).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
    expect(failure(5, 5)).toEqual({ action: 'transition', status: 'dead_letter' });
  });
});
