-- star_snapshots: 每日 cron 存入 GitHub stars 快照，用于飙升榜计算
CREATE TABLE star_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id     INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  stars         INTEGER NOT NULL,
  snapshot_date TEXT    NOT NULL DEFAULT (date('now'))
);

CREATE UNIQUE INDEX idx_star_snapshots_plugin_date ON star_snapshots(plugin_id, snapshot_date);
CREATE INDEX idx_star_snapshots_date ON star_snapshots(snapshot_date);

-- 生物医药科研 专题分类
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('生物医药科研', 'biomed', 'Dna', 13);

INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ((SELECT id FROM categories WHERE slug='biomed'), '生信工具', 'bioinfo-tools', 1),
  ((SELECT id FROM categories WHERE slug='biomed'), '文献检索', 'bio-literature', 2),
  ((SELECT id FROM categories WHERE slug='biomed'), '基因与蛋白分析', 'gene-protein', 3),
  ((SELECT id FROM categories WHERE slug='biomed'), '医学影像', 'medical-imaging', 4),
  ((SELECT id FROM categories WHERE slug='biomed'), '临床数据', 'clinical-data', 5),
  ((SELECT id FROM categories WHERE slug='biomed'), '药物研发', 'drug-discovery', 6);
