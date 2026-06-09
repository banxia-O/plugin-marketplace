import {
  Search,
  FileText,
  Database,
  MessageCircle,
  Briefcase,
  Code,
  Home,
  Palette,
  FlaskConical,
  Bot,
  Shield,
  Package,
  type LucideIcon,
} from 'lucide-react';

/** 分类 slug → Lucide 图标（见前端设计规范的图标映射） */
const ICONS: Record<string, LucideIcon> = {
  search: Search,
  files: FileText,
  data: Database,
  social: MessageCircle,
  office: Briefcase,
  dev: Code,
  life: Home,
  creative: Palette,
  research: FlaskConical,
  ai: Bot,
  security: Shield,
  other: Package,
};

export function categoryIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? Package;
}
