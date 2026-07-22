import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { PluginGrid } from '../components/PluginGrid.js';
import { useAsync } from '../lib/useAsync.js';

export function TrendingPage() {
  const { data, loading, error } = useAsync(() => apiClient.getTrending(50), []);

  return (
    <div className="container section">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-5)' }}>
        <ArrowLeft size={14} /> 返回首页
      </Link>

      <div className="page-head">
        <div className="page-head__intro">
          <h1 className="page-head__title">
            <TrendingUp size={26} color="var(--danger)" /> Star 飙升榜
          </h1>
          <p className="page-head__subtitle">按 GitHub Star 近 30 天净增长排序，每日更新，最多展示 50 个。</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>加载中…</div>
      ) : error ? (
        <div className="empty-state">榜单加载失败，请稍后重试。</div>
      ) : (
        <PluginGrid
          plugins={data?.plugins ?? []}
          emptyText="正在积累完整的 30 天 Star 快照，首期榜单会在数据满 30 天后自动出现。"
        />
      )}
    </div>
  );
}
