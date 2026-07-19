import type { ReviewTechnicalErrorCode } from '@ppx/shared';

export type ReviewErrorCode = ReviewTechnicalErrorCode | 'business_rejection' | 'github_not_found';
export type ReviewErrorKind = 'business' | 'technical';

export class ReviewError extends Error {
  constructor(
    public readonly code: ReviewErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly kind: ReviewErrorKind,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

function retryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
  return Number.isFinite(reset) && reset > Date.now() ? reset - Date.now() : undefined;
}

export function classifyGithubResponse(response: Response): ReviewError {
  if (response.status === 404) {
    return new ReviewError('github_not_found', 'GitHub 仓库不存在、不可见或已删除', false, 'business');
  }
  if (response.status === 401) {
    return new ReviewError('github_auth_error', 'GitHub 凭据无效或已过期', true, 'technical');
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    return new ReviewError('github_primary_rate_limit', 'GitHub 主速率限制', true, 'technical', retryAfterMs(response));
  }
  if (response.status === 403 || response.status === 429) {
    return new ReviewError('github_secondary_rate_limit', 'GitHub 次级速率限制', true, 'technical', retryAfterMs(response));
  }
  if (response.status >= 500) {
    return new ReviewError('github_server_error', `GitHub 服务错误 HTTP ${response.status}`, true, 'technical');
  }
  return new ReviewError('github_server_error', `GitHub API 非预期响应 HTTP ${response.status}`, false, 'technical');
}

export function toReviewError(error: unknown): ReviewError {
  if (error instanceof ReviewError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new ReviewError('github_timeout', 'GitHub 请求超时', true, 'technical');
  }
  return new ReviewError(
    'review_internal_error',
    error instanceof Error ? error.message : '审核服务内部错误',
    true,
    'technical',
  );
}
