import { z } from 'zod';

/** 部署方式：本地部署 / 远程服务 / 两者皆可 */
export const DeployMethod = z.enum(['local', 'remote', 'both']);
export type DeployMethod = z.infer<typeof DeployMethod>;

/** 审核状态：已审核 / 基础审核 / 未通过 */
export const ReviewStatus = z.enum(['verified', 'basic', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

/** agent.md 状态：可用 / 生成中 / 待完善 */
export const AgentMdStatus = z.enum(['ok', 'pending', 'incomplete']);
export type AgentMdStatus = z.infer<typeof AgentMdStatus>;

/** 排序方式 */
export const SortOrder = z.enum(['comprehensive', 'newest', 'hottest', 'top_rated', 'trending']);
export type SortOrder = z.infer<typeof SortOrder>;
