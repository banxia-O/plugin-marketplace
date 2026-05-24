import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { SearchBox } from '../components/SearchBox.js';
import { PluginGrid } from '../components/PluginGrid.js';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { data, loading } = useAsync(() => apiClient.getPlugins({ q, pageSize: 200 }), [q]);
  const results = data?.plugins ?? [];

  return (
    <div className="container section">
      <div className="page-head">
        <h1 className="page-head__title">搜索</h1>
      </div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <SearchBox initialValue={q} autoFocus />
      </div>

      {q && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
          “{q}” {loading ? '搜索中…' : `找到 ${results.length} 个插件`}
        </p>
      )}

      <PluginGrid plugins={results} emptyText={q ? '没找到匹配的插件，换个词试试。' : '输入关键词开始搜索。'} />
    </div>
  );
}
