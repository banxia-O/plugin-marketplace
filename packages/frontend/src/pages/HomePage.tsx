import { useMemo } from 'react';
import { Flame, Sparkles, LayoutGrid } from 'lucide-react';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { SearchBox } from '../components/SearchBox.js';
import { PluginGrid } from '../components/PluginGrid.js';
import { CategoryCard } from '../components/CategoryCard.js';

export function HomePage() {
  const categoriesState = useAsync(() => apiClient.getCategories(), []);
  const hotState = useAsync(() => apiClient.getPlugins({ sort: 'hottest', pageSize: 8 }), []);
  const newState = useAsync(() => apiClient.getPlugins({ sort: 'newest', pageSize: 8 }), []);
  const allState = useAsync(() => apiClient.getPlugins({ pageSize: 200 }), []);

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allState.data?.plugins ?? []) {
      const seen = new Set<string>();
      for (const c of p.categories) {
        if (!seen.has(c.categorySlug)) {
          seen.add(c.categorySlug);
          map.set(c.categorySlug, (map.get(c.categorySlug) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [allState.data]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1 className="hero__title">🏪 插件百宝阁</h1>
          <p className="hero__subtitle">给你的 AI 找趁手的工具</p>
          <div className="hero__search">
            <SearchBox autoFocus />
          </div>
        </div>
      </section>

      <div className="container">
        <section className="section">
          <h2 className="section__title">
            <Flame size={20} color="var(--accent-warm)" /> 热门推荐
          </h2>
          <PluginGrid plugins={hotState.data?.plugins ?? []} />
        </section>

        <section className="section">
          <h2 className="section__title">
            <Sparkles size={20} color="var(--primary)" /> 新上架
          </h2>
          <PluginGrid plugins={newState.data?.plugins ?? []} />
        </section>

        <section className="section">
          <h2 className="section__title">
            <LayoutGrid size={20} color="var(--accent-cyan)" /> 分类浏览
          </h2>
          <div className="category-grid">
            {(categoriesState.data?.categories ?? []).map((c) => (
              <CategoryCard key={c.slug} category={c} count={countByCategory.get(c.slug) ?? 0} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
