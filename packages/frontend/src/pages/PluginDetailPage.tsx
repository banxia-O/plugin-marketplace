import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, Heart, Star } from 'lucide-react';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { Markdown } from '../components/Markdown.js';
import { CopyButton } from '../components/CopyButton.js';
import { agentMdLabel, deployLabel, deployTagClass, reviewLabel, reviewTagClass } from '../lib/labels.js';

export function PluginDetailPage() {
  const { slug = '' } = useParams();
  const { data, loading, error } = useAsync(() => apiClient.getPlugin(slug), [slug]);

  if (loading) return <div className="container section">加载中…</div>;
  if (error || !data) {
    return (
      <div className="container section">
        <p>没找到这个插件。</p>
        <Link to="/" className="btn btn-ghost btn-sm">返回首页</Link>
      </div>
    );
  }

  const p = data.plugin;

  return (
    <div className="container section">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-5)' }}>
        <ArrowLeft size={14} /> 返回
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-head__title">{p.name}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0' }}>{p.oneLiner}</p>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          <h2 className="section__title">📖 agent.md</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '0 0 var(--space-4)' }}>
            agent.md 是面向 AI agent 优化的精简手册，由审核 AI 根据源仓库 README 自动生成。
            若需查看原始 README，建议前往源仓库。
          </p>
          {p.agentMd ? (
            <div className="detail-card">
              <Markdown content={p.agentMd} />
            </div>
          ) : (
            <div className="notice notice-warning">
              ⚠️ 该插件的 agent.md 待完善。源仓库 README 信息不足，欢迎在 GitHub 提交贡献改进。
            </div>
          )}
        </div>

        <aside className="detail-sidebar">
          <div className="detail-card">
            <ul className="detail-meta-list">
              <li>
                <span className="label">部署方式</span>
                <span className={`tag ${deployTagClass[p.deployMethod]}`}>{deployLabel[p.deployMethod]}</span>
              </li>
              <li>
                <span className="label">审核状态</span>
                <span className={`tag ${reviewTagClass[p.reviewStatus]}`}>{reviewLabel[p.reviewStatus]}</span>
              </li>
              <li>
                <span className="label">手册</span>
                <span>{agentMdLabel[p.agentMdStatus]}</span>
              </li>
              <li>
                <span className="label">许可证</span>
                <span>{p.license}</span>
              </li>
              <li>
                <span className="label">原作者</span>
                <a href={p.originalAuthorUrl ?? '#'} target="_blank" rel="noreferrer">
                  {p.originalAuthor}
                </a>
              </li>
              <li>
                <span className="label">最后更新</span>
                <span>{p.lastRepoUpdate ?? '—'}</span>
              </li>
              <li>
                <span className="label">数据</span>
                <span style={{ display: 'flex', gap: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                  <span><Star size={13} style={{ verticalAlign: '-2px' }} /> {p.stars}</span>
                  <span><Download size={13} style={{ verticalAlign: '-2px' }} /> {p.downloadCount}</span>
                  <span><Heart size={13} style={{ verticalAlign: '-2px' }} /> {p.likeCount}</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="detail-card">
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>支持平台</div>
            <div className="plugin-card__tags">
              {p.supportedPlatforms.map((plat) => (
                <span key={plat} className="tag tag-category">{plat}</span>
              ))}
            </div>
          </div>

          <CopyButton text={p.repoUrl} label="复制仓库地址" className="btn btn-secondary" />
          <a href={p.repoUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
            <ExternalLink size={14} /> 打开 GitHub 仓库
          </a>
        </aside>
      </div>
    </div>
  );
}
