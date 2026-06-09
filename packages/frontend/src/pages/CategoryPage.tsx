import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { DeployMethod, SortOrder } from '@ppx/shared';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { PluginGrid } from '../components/PluginGrid.js';
import { categoryIcon } from '../lib/categoryIcons.js';
import { deployLabel, sortOptions } from '../lib/labels.js';

const deployFilters: Array<{ value: DeployMethod | 'all'; label: string }> = [
  { value: 'all', label: '全部部署' },
  { value: 'local', label: deployLabel.local },
  { value: 'remote', label: deployLabel.remote },
  { value: 'both', label: deployLabel.both },
];

export function CategoryPage() {
  const { slug = '' } = useParams();
  const [sub, setSub] = useState<string>('all');
  const [deploy, setDeploy] = useState<DeployMethod | 'all'>('all');
  const [sort, setSort] = useState<SortOrder>('comprehensive');

  const categoriesState = useAsync(() => apiClient.getCategories(), []);
  const category = categoriesState.data?.categories.find((c) => c.slug === slug);

  // 整类（不带子类筛选）用于统计各子类数量
  const allInCat = useAsync(() => apiClient.getPlugins({ category: slug, pageSize: 200 }), [slug]);

  const subCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allInCat.data?.plugins ?? []) {
      for (const c of p.categories) {
        if (c.categorySlug === slug) map.set(c.subcategorySlug, (map.get(c.subcategorySlug) ?? 0) + 1);
      }
    }
    return map;
  }, [allInCat.data, slug]);

  const listState = useAsync(
    () =>
      apiClient.getPlugins({
        category: slug,
        subcategory: sub === 'all' ? undefined : sub,
        deployMethod: deploy === 'all' ? undefined : deploy,
        sort,
        pageSize: 200,
      }),
    [slug, sub, deploy, sort],
  );

  const Icon = categoryIcon(slug);
  const nonEmptySubs = (category?.subcategories ?? []).filter((s) => (subCounts.get(s.slug) ?? 0) > 0);

  if (categoriesState.data && !category) {
    return (
      <div className="container section">
        <p>没有这个分类。</p>
        <Link to="/" className="btn btn-ghost btn-sm">返回首页</Link>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="page-head">
        <h1 className="page-head__title">
          <Icon size={26} color="var(--primary)" /> {category?.name ?? slug}
        </h1>
      </div>

      {nonEmptySubs.length > 0 && (
        <div className="filter-row">
          <button className={`filter-tag ${sub === 'all' ? 'active' : ''}`} onClick={() => setSub('all')}>
            全部
          </button>
          {nonEmptySubs.map((s) => (
            <button key={s.slug} className={`filter-tag ${sub === s.slug ? 'active' : ''}`} onClick={() => setSub(s.slug)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="filter-row">
        {deployFilters.map((d) => (
          <button key={d.value} className={`filter-tag ${deploy === d.value ? 'active' : ''}`} onClick={() => setDeploy(d.value)}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        {sortOptions.map((o) => (
          <button key={o.value} className={`filter-tag ${sort === o.value ? 'active' : ''}`} onClick={() => setSort(o.value)}>
            {o.label}
          </button>
        ))}
      </div>

      <PluginGrid plugins={listState.data?.plugins ?? []} emptyText="该筛选下暂无插件，换个条件试试。" />
    </div>
  );
}
