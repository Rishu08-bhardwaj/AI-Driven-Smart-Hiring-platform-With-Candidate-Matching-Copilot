import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/** Pagination footer driven by server meta { page, totalPages, total }. */
export default function Pagination({ page, totalPages, total, onChange }) {
  if (!totalPages || totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-500">
        <span>{total ?? 0} record(s)</span>
      </div>
    );
  }

  const go = (p) => onChange(Math.min(Math.max(1, p), totalPages));
  const pages = pageWindow(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages} · {total} record(s)
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost px-2 py-1" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <FiChevronLeft />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-2 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              className={`min-w-[2rem] rounded-md px-2 py-1 text-sm ${
                p === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button className="btn-ghost px-2 py-1" onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}

function pageWindow(current, total) {
  const delta = 1;
  const range = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) range.push(i);
  if (range[0] > 1) range.unshift(range[0] > 2 ? '…' : 1);
  if (range[0] !== 1 && range[1] !== 1) range.unshift(1);
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) range.push('…');
    range.push(total);
  }
  return [...new Set(range)];
}
