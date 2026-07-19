import { z } from 'zod';
import { DeployMethod } from './enums.js';

/** POST /api/submissions 用户提交上架请求 */
export const SubmissionRequest = z.object({
  repoUrl: z.string().url('请填写有效的 GitHub 仓库地址'),
  name: z.string().min(1, '插件名称不能为空').max(100, '插件名称最多 100 字'),
  oneLiner: z.string().min(1, '一句话描述不能为空').max(200, '一句话描述最多 200 字'),
  subcategoryIds: z.array(z.number().int().positive()).min(1, '至少选择一个分类').max(12),
  deployMethod: DeployMethod,
  originalAuthor: z.string().max(100).optional(),
});
export type SubmissionRequest = z.infer<typeof SubmissionRequest>;

/** Worker 持久化的版本化审核任务载荷（派发时再补 submissionId/attempt）。 */
export type StoredReviewJobPayload = {
  payloadVersion: 1;
  idempotencyKey: string;
  repoUrl: string;
  name: string;
  oneLiner: string;
  subcategoryIds: number[];
  deployMethod: string;
  originalAuthor: string;
  uploaderUserId: number;
};

/** Worker 发给审核服务的任务载荷。 */
export type ReviewJobPayload = StoredReviewJobPayload & {
  submissionId: number;
  deliveryAttempt: number;
};

export const ReviewTechnicalErrorCode = z.enum([
  'github_auth_error',
  'github_primary_rate_limit',
  'github_secondary_rate_limit',
  'github_server_error',
  'github_timeout',
  'model_error',
  'callback_error',
  'review_internal_error',
]);
export type ReviewTechnicalErrorCode = z.infer<typeof ReviewTechnicalErrorCode>;

/** 审核通过时，审核服务回写给 Worker 的插件数据 */
export const ReviewPluginData = z.object({
  slug: z.string(),
  name: z.string(),
  oneLiner: z.string(),
  descriptionMd: z.string(),
  repoUrl: z.string(),
  agentMd: z.string().nullable(),
  agentMdStatus: z.enum(['ok', 'pending', 'incomplete']),
  deployMethod: z.enum(['local', 'remote', 'both']),
  supportedPlatforms: z.array(z.string()),
  license: z.string(),
  originalAuthor: z.string(),
  originalAuthorUrl: z.string().nullable(),
  stars: z.number().int(),
  lastRepoUpdate: z.string().nullable(),
  reviewStatus: z.enum(['verified', 'basic', 'rejected']),
  subcategoryIds: z.array(z.number().int()),
  uploaderUserId: z.number().int(),
});
export type ReviewPluginData = z.infer<typeof ReviewPluginData>;

/** 审核服务回写 Worker admin 接口的完整结果（鉴别联合） */
export const ReviewResultPayload = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('done'),
    submissionId: z.number().int(),
    deliveryAttempt: z.number().int().positive(),
    callbackKey: z.string().min(1),
    plugin: ReviewPluginData,
  }),
  z.object({
    status: z.literal('rejected'),
    submissionId: z.number().int(),
    deliveryAttempt: z.number().int().positive(),
    callbackKey: z.string().min(1),
    reasonCode: z.enum(['business_rejection', 'github_not_found']),
    rejectReason: z.string(),
  }),
  z.object({
    status: z.literal('failed'),
    submissionId: z.number().int(),
    deliveryAttempt: z.number().int().positive(),
    callbackKey: z.string().min(1),
    errorCode: ReviewTechnicalErrorCode,
    errorMessage: z.string(),
    retryable: z.boolean(),
    retryAfterMs: z.number().int().nonnegative().optional(),
  }),
]);
export type ReviewResultPayload = z.infer<typeof ReviewResultPayload>;

/** GET /api/submissions/:id 返回结构 */
export const SubmissionStatus = z.object({
  id: z.number().int(),
  repoUrl: z.string(),
  status: z.enum(['queued', 'dispatching', 'processing', 'retry_wait', 'done', 'rejected', 'failed', 'dead_letter']),
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
});
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;
