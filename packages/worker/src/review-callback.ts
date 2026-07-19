import { calculateRetryDelayMs } from './retry-policy.js';
import { decideCallbackTransition } from './submission-state.js';
import type { CallbackEvent, CallbackState } from './submission-state.js';

interface FailedCallbackEvent extends CallbackEvent {
  retryAfterMs?: number;
}

interface CallbackPlanOptions {
  nowMs?: number;
  random?: () => number;
}

export type ReviewCallbackPlan =
  | ReturnType<typeof decideCallbackTransition>
  | { action: 'transition'; status: 'retry_wait'; nextAttemptAt: string };

export function planReviewCallback(
  state: CallbackState,
  event: FailedCallbackEvent,
  options: CallbackPlanOptions = {},
): ReviewCallbackPlan {
  const decision = decideCallbackTransition(state, event);
  if (decision.action !== 'transition' || decision.status !== 'retry_wait') return decision;
  const nowMs = options.nowMs ?? Date.now();
  const delay = calculateRetryDelayMs({
    attempt: state.attemptCount,
    retryAfterMs: event.retryAfterMs,
    nowMs,
    random: options.random,
  });
  return { ...decision, nextAttemptAt: new Date(nowMs + delay).toISOString() };
}
