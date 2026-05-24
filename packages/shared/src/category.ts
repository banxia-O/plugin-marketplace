import { z } from 'zod';

export const Subcategory = z.object({
  id: z.number().int(),
  categoryId: z.number().int(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number().int(),
});
export type Subcategory = z.infer<typeof Subcategory>;

export const Category = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  /** Lucide 图标名，见前端设计规范的图标映射 */
  icon: z.string(),
  sortOrder: z.number().int(),
  subcategories: z.array(Subcategory),
});
export type Category = z.infer<typeof Category>;
