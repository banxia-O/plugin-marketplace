-- 插件百宝阁 V1 初始 schema
-- 大类固定、子类动态；插件与子类多对多。

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  icon        TEXT    NOT NULL,            -- Lucide 图标名
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, slug)
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    UNIQUE,
  password_hash TEXT,                       -- 为空 = 仅 OAuth 用户
  github_id     INTEGER UNIQUE,
  github_login  TEXT,
  avatar_url    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE plugins (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  slug                TEXT    NOT NULL UNIQUE,
  one_liner           TEXT    NOT NULL,
  description_md      TEXT    NOT NULL DEFAULT '',
  repo_url            TEXT    NOT NULL UNIQUE,         -- 同仓查重
  agent_md            TEXT,
  agent_md_status     TEXT    NOT NULL DEFAULT 'incomplete'
                       CHECK (agent_md_status IN ('ok','pending','incomplete')),
  deploy_method       TEXT    NOT NULL
                       CHECK (deploy_method IN ('local','remote','both')),
  supported_platforms TEXT    NOT NULL DEFAULT '[]',   -- JSON 数组
  license             TEXT    NOT NULL DEFAULT '',
  original_author     TEXT    NOT NULL DEFAULT '',
  original_author_url TEXT,
  uploader_user_id    INTEGER REFERENCES users(id),
  review_status       TEXT    NOT NULL DEFAULT 'basic'
                       CHECK (review_status IN ('verified','basic','rejected')),
  stars               INTEGER NOT NULL DEFAULT 0,
  download_count      INTEGER NOT NULL DEFAULT 0,
  like_count          INTEGER NOT NULL DEFAULT 0,
  last_repo_update    TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE plugin_categories (
  plugin_id      INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
  PRIMARY KEY (plugin_id, subcategory_id)
);

-- V1 隐藏账本：append-only，记录所有行为，V2 据此补发积分
CREATE TABLE ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  actor_type    TEXT    NOT NULL CHECK (actor_type IN ('user','agent','system')),
  action        TEXT    NOT NULL CHECK (action IN ('upload','download','like')),
  plugin_id     INTEGER REFERENCES plugins(id),
  metadata      TEXT    NOT NULL DEFAULT '{}',          -- JSON
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 审核工作流提交记录，与最终 plugins 行解耦
CREATE TABLE submissions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_url         TEXT    NOT NULL,
  uploader_user_id INTEGER REFERENCES users(id),
  status           TEXT    NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','processing','done','rejected')),
  reject_reason    TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subcategories_category ON subcategories(category_id);
CREATE INDEX idx_plugin_categories_subcategory ON plugin_categories(subcategory_id);
CREATE INDEX idx_plugins_review_status ON plugins(review_status);
CREATE INDEX idx_ledger_action ON ledger(action);
CREATE INDEX idx_submissions_status ON submissions(status);
