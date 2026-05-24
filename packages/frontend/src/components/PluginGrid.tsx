import type { PluginSummary } from '@ppx/shared';
import { PluginCard } from './PluginCard.js';

export function PluginGrid({ plugins, emptyText = '这里还没有插件，敬请期待～' }: { plugins: PluginSummary[]; emptyText?: string }) {
  if (plugins.length === 0) {
    return <div className="empty-state">{emptyText}</div>;
  }
  return (
    <div className="plugin-grid">
      {plugins.map((p) => (
        <PluginCard key={p.id} plugin={p} />
      ))}
    </div>
  );
}
