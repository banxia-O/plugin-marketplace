-- 12 大类（固定）+ 子类种子。子类后台可动态增删，此处灌入分类体系文档定义的初始集。

INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('信息检索',   'search',   'Search',        1),
  ('文件与文档', 'files',    'FileText',      2),
  ('数据与数据库','data',    'Database',      3),
  ('社交与通讯', 'social',   'MessageCircle', 4),
  ('办公与协作', 'office',   'Briefcase',     5),
  ('开发工具',   'dev',      'Code',          6),
  ('生活服务',   'life',     'Home',          7),
  ('创意与设计', 'creative', 'Palette',       8),
  ('科研学术',   'research', 'FlaskConical',  9),
  ('AI 与模型',  'ai',       'Bot',          10),
  ('安全与运维', 'security', 'Shield',       11),
  ('其他',       'other',    'Package',      12);

INSERT INTO subcategories (category_id, name, slug, sort_order)
SELECT c.id, s.name, s.slug, s.sort_order
FROM categories c
JOIN (
  SELECT 'search'   AS cat, '搜索引擎' AS name, 'search-engine' AS slug, 1 AS sort_order UNION ALL
  SELECT 'search',   '网页抓取', 'web-scraping', 2 UNION ALL
  SELECT 'search',   '新闻资讯', 'news',         3 UNION ALL
  SELECT 'search',   '知识百科', 'knowledge',    4 UNION ALL

  SELECT 'files',    '文件系统', 'filesystem',   1 UNION ALL
  SELECT 'files',    '文档处理', 'document',     2 UNION ALL
  SELECT 'files',    '云存储',   'cloud-storage',3 UNION ALL

  SELECT 'data',     'SQL 数据库',  'sql',        1 UNION ALL
  SELECT 'data',     'NoSQL 数据库','nosql',      2 UNION ALL
  SELECT 'data',     '数据可视化',  'viz',        3 UNION ALL
  SELECT 'data',     '数据处理',    'processing', 4 UNION ALL

  SELECT 'social',   '即时通讯', 'im',           1 UNION ALL
  SELECT 'social',   '社交媒体', 'social-media', 2 UNION ALL
  SELECT 'social',   '邮件',     'email',        3 UNION ALL

  SELECT 'office',   '日历日程', 'calendar',     1 UNION ALL
  SELECT 'office',   '项目管理', 'project',      2 UNION ALL
  SELECT 'office',   '笔记写作', 'notes',        3 UNION ALL
  SELECT 'office',   '演示文稿', 'slides',       4 UNION ALL

  SELECT 'dev',      '代码仓库',     'repo',      1 UNION ALL
  SELECT 'dev',      'CI/CD',        'cicd',      2 UNION ALL
  SELECT 'dev',      '终端命令行',   'terminal',  3 UNION ALL
  SELECT 'dev',      'API 与调试',   'api',       4 UNION ALL
  SELECT 'dev',      '容器与云服务', 'cloud',     5 UNION ALL

  SELECT 'life',     '天气',     'weather',      1 UNION ALL
  SELECT 'life',     '地图导航', 'map',          2 UNION ALL
  SELECT 'life',     '出行旅行', 'travel',       3 UNION ALL
  SELECT 'life',     '购物比价', 'shopping',     4 UNION ALL
  SELECT 'life',     '时间工具', 'time',         5 UNION ALL

  SELECT 'creative', '图片生成', 'image-gen',    1 UNION ALL
  SELECT 'creative', '图片处理', 'image-edit',   2 UNION ALL
  SELECT 'creative', '音频音乐', 'audio',        3 UNION ALL
  SELECT 'creative', '视频',     'video',        4 UNION ALL
  SELECT 'creative', 'UI/设计',  'design',       5 UNION ALL

  SELECT 'research', '文献检索',   'literature', 1 UNION ALL
  SELECT 'research', '医学',       'medical',    2 UNION ALL
  SELECT 'research', '法律',       'legal',      3 UNION ALL
  SELECT 'research', '金融',       'finance',    4 UNION ALL
  SELECT 'research', '数学计算',   'math',       5 UNION ALL
  SELECT 'research', '生物信息',   'bioinfo',    6 UNION ALL
  SELECT 'research', '化学材料',   'chem',       7 UNION ALL

  SELECT 'ai',       '记忆与知识', 'memory',     1 UNION ALL
  SELECT 'ai',       'Prompt 工具','prompt',     2 UNION ALL
  SELECT 'ai',       '模型管理',   'model',      3 UNION ALL
  SELECT 'ai',       'Agent 框架', 'agent',      4 UNION ALL

  SELECT 'security', '安全扫描', 'scan',         1 UNION ALL
  SELECT 'security', '监控告警', 'monitor',      2 UNION ALL
  SELECT 'security', '网络工具', 'network',      3
) s ON s.cat = c.slug;
