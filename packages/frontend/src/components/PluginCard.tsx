import { Link, useNavigate } from 'react-router-dom';
import { Download, Heart, RefreshCw } from 'lucide-react';
import type { PluginSummary } from '@ppx/shared';
import { deployLabel, deployTagClass, reviewLabel, reviewTagClass } from '../lib/labels.js';
import { CopyButton } from './CopyButton.js';

export function PluginCard({ plugin }: { plugin: PluginSummary }) {
  const navigate = useNavigate();

  return (
    <article
      className="plugin-card"
      onClick={() => navigate(`/plugin/${plugin.slug}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/plugin/${plugin.slug}`);
      }}
    >
      <div className="plugin-card__head">
        <h3 className="plugin-card__title">{plugin.name}</h3>
        <span className="plugin-card__likes">
          <Heart size={13} style={{ verticalAlign: '-2px' }} /> {plugin.likeCount}
        </span>
      </div>
      <p className="plugin-card__desc">{plugin.oneLiner}</p>

      <div className="plugin-card__tags">
        {plugin.categories.slice(0, 2).map((c) => (
          <span key={`${c.categorySlug}/${c.subcategorySlug}`} className="tag tag-category">
            {c.categoryName}·{c.subcategoryName}
          </span>
        ))}
        <span className={`tag ${deployTagClass[plugin.deployMethod]}`}>{deployLabel[plugin.deployMethod]}</span>
      </div>

      <div className="plugin-card__meta">
        <span>
          <Download size={13} style={{ verticalAlign: '-2px' }} /> {plugin.downloadCount}
        </span>
        <span>作者：{plugin.originalAuthor}</span>
        {plugin.lastRepoUpdate && (
          <span>
            <RefreshCw size={12} style={{ verticalAlign: '-2px' }} /> {plugin.lastRepoUpdate}
          </span>
        )}
        <span className={`tag ${reviewTagClass[plugin.reviewStatus]}`}>{reviewLabel[plugin.reviewStatus]}</span>
      </div>

      <div className="plugin-card__actions" onClick={(e) => e.stopPropagation()}>
        <CopyButton text={plugin.repoUrl} label="复制仓库" className="btn btn-secondary btn-sm" />
        <Link to={`/plugin/${plugin.slug}`} className="btn btn-primary btn-sm">
          📖 agent.md
        </Link>
      </div>
    </article>
  );
}
