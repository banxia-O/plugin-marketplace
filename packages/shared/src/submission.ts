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

/** Worker 发给审核服务的任务载荷 */
export type ReviewJobPayload = {
  submissionId: number;
  repoUrl: string;
  name: string;
  oneLiner: string;
  subcategoryIds: number[];
  deployMethod: string;
  originalAuthor: string;
  uploaderUserId: number;
};

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
  z.object({ status: z.literal('done'), submissionId: z.number().int(), plugin: ReviewPluginData }),
  z.object({ status: z.literal('rejected'), submissionId: z.number().int(), rejectReason: z.string() }),
]);
export type ReviewResultPayload = z.infer<typeof ReviewResultPayload>;

/** GET /api/submissions/:id 返回结构 */
export const SubmissionStatus = z.object({
  id: z.number().int(),
  repoUrl: z.string(),
  status: z.enum(['queued', 'processing', 'done', 'rejected']),
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
});
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;
