import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { DeployMethod } from '@ppx/shared';
import { apiClient } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.js';
import { AuthModal } from '../components/AuthModal.js';
import { deployLabel } from '../lib/labels.js';

const deployOptions: DeployMethod[] = ['local', 'remote', 'both'];

export function UploadPage() {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const categoriesState = useAsync(() => apiClient.getCategories(), []);

  const [name, setName] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [originalAuthor, setOriginalAuthor] = useState('');
  const [deployMethod, setDeployMethod] = useState<DeployMethod>('local');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<number | null>(null);

  const categories = categoriesState.data?.categories ?? [];
  const canSubmit = useMemo(
    () => name.trim() && oneLiner.trim() && repoUrl.trim() && selected.size > 0 && agreed,
    [name, oneLiner, repoUrl, selected, agreed],
  );

  function toggleSub(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.createSubmission({
        repoUrl: repoUrl.trim(),
        name: name.trim(),
        oneLiner: oneLiner.trim(),
        subcategoryIds: [...selected],
        deployMethod,
        originalAuthor: originalAuthor.trim() || undefined,
      });
      setDoneId(res.submissionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  // 未登录门禁
  if (!user) {
    return (
      <div className="container section">
        <div className="page-head">
          <h1 className="page-head__title">上传插件</h1>
        </div>
        <div className="empty-state">
          <p>上传插件需要先登录。</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowAuth(true)}>
            登录 / 注册
          </button>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // 提交成功
  if (doneId !== null) {
    return (
      <div className="container section">
        <div className="page-head">
          <h1 className="page-head__title">提交成功 🎉</h1>
        </div>
        <div className="detail-card">
          <p>
            你的插件已进入审核队列（提交编号 <strong>#{doneId}</strong>）。平台会自动校验仓库、检测许可证、
            生成 agent.md，通过后即出现在对应分类下。
          </p>
          <p className="form-hint">
            公测期所有贡献行为均已记录，积分系统上线后将按规则补发。
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Link to="/" className="btn btn-ghost btn-sm">返回首页</Link>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDoneId(null);
                setName('');
                setOneLiner('');
                setRepoUrl('');
                setOriginalAuthor('');
                setSelected(new Set());
                setAgreed(false);
              }}
            >
              再传一个
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="page-head">
        <h1 className="page-head__title">上传插件</h1>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginTop: 'calc(-1 * var(--space-3))', marginBottom: 'var(--space-6)' }}>
        填写下面几项就好，剩下的（agent.md 生成、原作者抓取、安全扫描）平台自动完成。
      </p>

      <form className="upload-form" onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="up-name">插件名称</label>
          <input id="up-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="up-oneliner">一句话描述</label>
          <input
            id="up-oneliner"
            className="form-input"
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="它能帮 agent 做什么？"
            maxLength={200}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="up-repo">GitHub 仓库地址</label>
          <input
            id="up-repo"
            className="form-input"
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">部署方式</label>
          <div className="filter-row" style={{ marginBottom: 0 }}>
            {deployOptions.map((d) => (
              <button
                key={d}
                type="button"
                className={`filter-tag ${deployMethod === d ? 'active' : ''}`}
                onClick={() => setDeployMethod(d)}
              >
                {deployLabel[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            功能分类 <span className="form-hint">（可多选，至少一个）</span>
          </label>
          {categoriesState.loading && <p className="form-hint">加载分类中…</p>}
          <div className="cat-picker">
            {categories.map((cat) => (
              <div key={cat.id} className="cat-picker__group">
                <span className="cat-picker__title">{cat.name}</span>
                <div className="cat-picker__subs">
                  {cat.subcategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className={`filter-tag ${selected.has(sub.id) ? 'active' : ''}`}
                      onClick={() => toggleSub(sub.id)}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="up-author">
            原作者 <span className="form-hint">（选填，留空则自动抓取仓库 owner）</span>
          </label>
          <input
            id="up-author"
            className="form-input"
            value={originalAuthor}
            onChange={(e) => setOriginalAuthor(e.target.value)}
            placeholder="fork 仓库等情况可手动填写"
            maxLength={100}
          />
        </div>

        <label className="form-checkbox">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            我确认该仓库为开源项目（MIT / Apache 2.0 等宽松许可证），并已注明原作者信息。
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={!canSubmit || busy}>
          {busy ? '提交中…' : '提交审核'}
        </button>
      </form>
    </div>
  );
}
