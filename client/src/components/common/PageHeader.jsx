import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

/** Page title + breadcrumb + optional right-aligned actions. */
export default function PageHeader({ title, subtitle, breadcrumbs = [], actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {breadcrumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.to ? (
                  <Link to={b.to} className="hover:text-brand-600">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-slate-500">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <FiChevronRight size={12} />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
