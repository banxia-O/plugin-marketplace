import { Link } from 'react-router-dom';
import type { Category } from '@ppx/shared';
import { categoryIcon } from '../lib/categoryIcons.js';

export function CategoryCard({ category, count }: { category: Category; count: number }) {
  const Icon = categoryIcon(category.slug);
  return (
    <Link to={`/category/${category.slug}`} className="category-card">
      <span className="category-card__icon">
        <Icon size={22} />
      </span>
      <span>
        <div className="category-card__name">{category.name}</div>
        <div className="category-card__count">{count > 0 ? `${count} 个插件` : '即将上架'}</div>
      </span>
    </Link>
  );
}
