import type {
  CategoriesResponse,
  PluginDetail,
  PluginDetailResponse,
  PluginListQuery,
  PluginListResponse,
  PluginSummary,
} from '@ppx/shared';
import { categories as seedCategories, plugins as seedPlugins } from '@ppx/shared/fixtures';

// Phase 1：apiClient 由打包的种子数据驱动。Phase 2 将把实现替换为对真实 Worker 的 fetch，
// 由于两侧共享 @ppx/shared 的 zod 契约，替换只需改这一个模块。

function toSummary(p: PluginDetail): PluginSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    oneLiner: p.oneLiner,
    repoUrl: p.repoUrl,
    deployMethod: p.deployMethod,
    reviewStatus: p.reviewStatus,
    agentMdStatus: p.agentMdStatus,
    stars: p.stars,
    downloadCount: p.downloadCount,
    likeCount: p.likeCount,
    originalAuthor: p.originalAuthor,
    categories: p.categories,
    lastRepoUpdate: p.lastRepoUpdate,
    updatedAt: p.updatedAt,
  };
}

function matchesQuery(p: PluginDetail, q: string): boolean {
  const hay = [
    p.name,
    p.oneLiner,
    p.descriptionMd,
    ...p.categories.flatMap((c) => [c.categoryName, c.subcategoryName]),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

function sortPlugins(list: PluginDetail[], sort: PluginListQuery['sort']): PluginDetail[] {
  const arr = [...list];
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'hottest':
      return arr.sort((a, b) => b.downloadCount - a.downloadCount);
    case 'top_rated':
      return arr.sort((a, b) => b.likeCount - a.likeCount);
    case 'comprehensive':
    default:
      return arr.sort(
        (a, b) => b.downloadCount + b.likeCount * 3 - (a.downloadCount + a.likeCount * 3),
      );
  }
}

async function getCategories(): Promise<CategoriesResponse> {
  return { categories: seedCategories };
}

async function getPlugins(query: Partial<PluginListQuery> = {}): Promise<PluginListResponse> {
  const { category, subcategory, deployMethod, q, sort = 'comprehensive', page = 1, pageSize = 24 } = query;

  let list = seedPlugins.filter((p) => p.reviewStatus !== 'rejected');
  if (category) list = list.filter((p) => p.categories.some((c) => c.categorySlug === category));
  if (subcategory) list = list.filter((p) => p.categories.some((c) => c.subcategorySlug === subcategory));
  if (deployMethod) list = list.filter((p) => p.deployMethod === deployMethod);
  if (q && q.trim()) list = list.filter((p) => matchesQuery(p, q.trim()));

  list = sortPlugins(list, sort);

  const total = list.length;
  const start = (page - 1) * pageSize;
  const pageItems = list.slice(start, start + pageSize).map(toSummary);

  return { plugins: pageItems, total, page, pageSize };
}

async function getPlugin(slug: string): Promise<PluginDetailResponse> {
  const plugin = seedPlugins.find((p) => p.slug === slug);
  if (!plugin) throw new Error('插件不存在');
  return { plugin };
}

export const apiClient = { getCategories, getPlugins, getPlugin };
