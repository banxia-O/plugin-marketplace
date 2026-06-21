import { useMemo } from 'react';
import { Dna, Flame, LayoutGrid, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { SearchBox } from '../components/SearchBox.js';
import { PluginGrid } from '../components/PluginGrid.js';
import { CategoryCard } from '../components/CategoryCard.js';

export function HomePage() {
  const categoriesState = useAsync(() => apiClient.getCategories(), []);
  const hotState = useAsync(() => apiClient.getPlugins({ sort: 'hottest', pageSize: 8 }), []);
  const newState = useAsync(() => apiClient.getPlugins({ sort: 'newest', pageSize: 8 }), []);
  const trendingState = useAsync(() => apiClient.getTrending(), []);
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

  const trendingPlugins = trendingState.data?.plugins ?? [];

  return (
    <>
      <section className="hero">
        <div className="hero__overlay" aria-hidden />
        <div className="container hero__content">
          <h1 className="hero__title">插件百宝阁</h1>
          <p className="hero__subtitle">半夏筛选的 AI 工具与 MCP 插件地图</p>
          <div className="hero__search">
            <SearchBox autoFocus />
          </div>
        </div>
      </section>

      <div className="container">
        {/* 两张入口卡片 */}
        <section className="section">
          <div className="entry-cards">
            <Link to="/category/biomed" className="entry-card entry-card--trending">
              <TrendingUp size={28} />
              <div>
                <h3 className="entry-card__title">⭐ 飙升榜</h3>
                <p className="entry-card__desc">近 30 天 GitHub Star 增长最快的插件</p>
              </div>
              {trendingPlugins.length > 0 && (
                <span className="entry-card__badge">{trendingPlugins.length} 个上榜</span>
              )}
            </Link>
            <Link to="/zone/biomed" className="entry-card entry-card--biomed">
              <Dna size={28} />
              <div>
                <h3 className="entry-card__title">生物医药科研</h3>
                <p className="entry-card__desc">半夏私藏的生信、医学影像、基因分析工具</p>
              </div>
            </Link>
          </div>
        </section>

        {/* 飙升榜（有数据才显示） */}
        {trendingPlugins.length > 0 && (
          <section className="section">
            <h2 className="section__title">
              <TrendingUp size={20} color="var(--danger)" /> 近月飙升
            </h2>
            <PluginGrid plugins={trendingPlugins} />
          </section>
        )}

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
