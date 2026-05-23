import { z } from 'zod';
import { Category } from './category.js';
import { PluginDetail, PluginSummary } from './plugin.js';
import { DeployMethod, SortOrder } from './enums.js';

/** GET /api/categories */
export const CategoriesResponse = z.object({
  categories: z.array(Category),
});
export type CategoriesResponse = z.infer<typeof CategoriesResponse>;

/** GET /api/plugins 查询参数 */
export const PluginListQuery = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  deployMethod: DeployMethod.optional(),
  sort: SortOrder.default('comprehensive'),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(24),
});
export type PluginListQuery = z.infer<typeof PluginListQuery>;

/** GET /api/plugins */
export const PluginListResponse = z.object({
  plugins: z.array(PluginSummary),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type PluginListResponse = z.infer<typeof PluginListResponse>;

/** GET /api/plugins/:slug */
export const PluginDetailResponse = z.object({
  plugin: PluginDetail,
});
export type PluginDetailResponse = z.infer<typeof PluginDetailResponse>;

export const ErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
