import { Link } from 'react-router-dom';
import { ArrowLeft, Dna } from 'lucide-react';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { PluginGrid } from '../components/PluginGrid.js';

export function ZoneBiomedPage() {
  const { data, loading } = useAsync(
    () => apiClient.getPlugins({ category: 'biomed', pageSize: 200 }),
    [],
  );

  return (
    <div className="container section">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-5)' }}>
        <ArrowLeft size={14} /> 返回首页
      </Link>

      <div className="zone-hero zone-hero--biomed">
        <Dna size={36} />
        <h1 className="zone-hero__title">生物医药科研</h1>
        <p className="zone-hero__subtitle">
          半夏私藏的生信、医学影像、基因分析、文献检索等 AI 工具合集
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>加载中…</div>
      ) : (
        <PluginGrid plugins={data?.plugins ?? []} />
      )}
    </div>
  );
}
