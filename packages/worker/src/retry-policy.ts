export const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

export interface RetryPolicyInput {
  attempt: number;
  retryAfter?: string | null;
  retryAfterMs?: number;
  rateLimitReset?: string | null;
  nowMs?: number;
  random?: () => number;
}

function serverRequiredDelayMs(input: RetryPolicyInput, nowMs: number): number | null {
  const requirements: number[] = [];
  if (input.retryAfterMs !== undefined && Number.isFinite(input.retryAfterMs)) {
    requirements.push(Math.max(0, input.retryAfterMs));
  }
  if (input.retryAfter) {
    const seconds = Number(input.retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) requirements.push(seconds * 1000);
    else {
      const dateMs = Date.parse(input.retryAfter);
      if (Number.isFinite(dateMs)) requirements.push(Math.max(0, dateMs - nowMs));
    }
  }
  if (input.rateLimitReset) {
    const resetMs = Number(input.rateLimitReset) * 1000;
    if (Number.isFinite(resetMs)) requirements.push(Math.max(0, resetMs - nowMs));
  }
  return requirements.length === 0 ? null : Math.max(...requirements);
}

export function calculateRetryDelayMs(input: RetryPolicyInput): number {
  const nowMs = input.nowMs ?? Date.now();
  const random = input.random ?? Math.random;
  const exponential = Math.min(10_000 * 2 ** Math.max(0, input.attempt - 1), MAX_RETRY_DELAY_MS);
  const required = serverRequiredDelayMs(input, nowMs);
  if (required !== null) {
    const floor = Math.max(exponential, required);
    const positiveJitter = Math.min(30_000, floor * 0.1) * random();
    return Math.round(floor + positiveJitter);
  }
  return Math.min(Math.round(exponential * (0.5 + random())), MAX_RETRY_DELAY_MS);
}
