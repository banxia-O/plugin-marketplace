import { describe, expect, it } from 'vitest';
import { assertSubmissionTransition, decideCallbackTransition } from '../src/submission-state.js';

describe('submission state machine', () => {
  it.each([
    ['queued', 'dispatching'],
    ['dispatching', 'processing'],
    ['dispatching', 'retry_wait'],
    ['retry_wait', 'dispatching'],
    ['processing', 'done'],
    ['processing', 'rejected'],
    ['processing', 'retry_wait'],
    ['retry_wait', 'dead_letter'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(() => assertSubmissionTransition(from, to)).not.toThrow();
  });

  it('rejects illegal transitions', () => {
    expect(() => assertSubmissionTransition('queued', 'done')).toThrow(/Illegal submission transition/);
    expect(() => assertSubmissionTransition('done', 'processing')).toThrow(/Illegal submission transition/);
  });

  it('never maps a technical failure to rejected', () => {
    expect(
      decideCallbackTransition(
        { status: 'processing', attemptCount: 2, maxAttempts: 4, lastCallbackAttempt: null },
        { status: 'failed', deliveryAttempt: 2, retryable: true },
      ),
    ).toEqual({ action: 'transition', status: 'retry_wait' });
  });

  it('ignores duplicate and stale callbacks', () => {
    expect(
      decideCallbackTransition(
        { status: 'done', attemptCount: 2, maxAttempts: 4, lastCallbackAttempt: 2 },
        { status: 'done', deliveryAttempt: 2 },
      ),
    ).toEqual({ action: 'ignore', reason: 'terminal' });

    expect(
      decideCallbackTransition(
        { status: 'processing', attemptCount: 3, maxAttempts: 4, lastCallbackAttempt: 2 },
        { status: 'done', deliveryAttempt: 2 },
      ),
    ).toEqual({ action: 'ignore', reason: 'stale_callback' });
  });
});
