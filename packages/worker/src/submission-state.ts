export const SUBMISSION_STATUSES = [
  'queued',
  'dispatching',
  'processing',
  'retry_wait',
  'done',
  'rejected',
  'failed',
  'dead_letter',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<SubmissionStatus, ReadonlySet<SubmissionStatus>> = {
  queued: new Set(['dispatching', 'failed']),
  dispatching: new Set(['dispatching', 'processing', 'retry_wait', 'done', 'rejected', 'failed', 'dead_letter']),
  processing: new Set(['dispatching', 'retry_wait', 'done', 'rejected', 'failed', 'dead_letter']),
  retry_wait: new Set(['dispatching', 'failed', 'dead_letter']),
  done: new Set(),
  rejected: new Set(),
  failed: new Set(),
  dead_letter: new Set(),
};

export function assertSubmissionTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!ALLOWED_TRANSITIONS[from].has(to)) {
    throw new Error(`Illegal submission transition: ${from} -> ${to}`);
  }
}

type CallbackStatus = 'done' | 'rejected' | 'failed';

export interface CallbackState {
  status: SubmissionStatus;
  attemptCount: number;
  maxAttempts: number;
  lastCallbackAttempt: number | null;
}

export interface CallbackEvent {
  status: CallbackStatus;
  deliveryAttempt: number;
  retryable?: boolean;
}

export type CallbackDecision =
  | { action: 'ignore'; reason: 'terminal' | 'stale_callback' | 'duplicate_callback' }
  | { action: 'transition'; status: SubmissionStatus };

export function decideCallbackTransition(state: CallbackState, event: CallbackEvent): CallbackDecision {
  if (['done', 'rejected', 'failed', 'dead_letter'].includes(state.status)) {
    return { action: 'ignore', reason: 'terminal' };
  }
  if (event.deliveryAttempt !== state.attemptCount) {
    return { action: 'ignore', reason: 'stale_callback' };
  }
  if (state.lastCallbackAttempt !== null && event.deliveryAttempt <= state.lastCallbackAttempt) {
    return { action: 'ignore', reason: 'duplicate_callback' };
  }

  if (event.status === 'done') return { action: 'transition', status: 'done' };
  if (event.status === 'rejected') return { action: 'transition', status: 'rejected' };
  if (!event.retryable) return { action: 'transition', status: 'failed' };
  return {
    action: 'transition',
    status: state.attemptCount >= state.maxAttempts ? 'dead_letter' : 'retry_wait',
  };
}
