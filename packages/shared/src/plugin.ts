import { z } from 'zod';
import { AgentMdStatus, DeployMethod, ReviewStatus } from './enums.js';

/** 插件所属分类引用（大类 + 子类 slug） */
export const PluginCategoryRef = z.object({
  categorySlug: z.string(),
  categoryName: z.string(),
  subcategorySlug: z.string(),
  subcategoryName: z.string(),
});
export type PluginCategoryRef = z.infer<typeof PluginCategoryRef>;

/** 列表/卡片视图的精简插件信息 */
export const PluginSummary = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  oneLiner: z.string(),
  deployMethod: DeployMethod,
  reviewStatus: ReviewStatus,
  agentMdStatus: AgentMdStatus,
  stars: z.number().int(),
  downloadCount: z.number().int(),
  likeCount: z.number().int(),
  originalAuthor: z.string(),
  categories: z.array(PluginCategoryRef),
  lastRepoUpdate: z.string().nullable(),
  updatedAt: z.string(),
});
export type PluginSummary = z.infer<typeof PluginSummary>;

/** 详情视图的完整插件信息 */
export const PluginDetail = PluginSummary.extend({
  descriptionMd: z.string(),
  agentMd: z.string().nullable(),
  repoUrl: z.string().url(),
  originalAuthorUrl: z.string().url().nullable(),
  supportedPlatforms: z.array(z.string()),
  license: z.string(),
  createdAt: z.string(),
});
export type PluginDetail = z.infer<typeof PluginDetail>;
