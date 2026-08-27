import { NavLink } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { NAV_ITEMS } from './navConfig.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Sidebar({ mobileOpen, onClose }) {
  const { can } = useAuth();
  const items = NAV_ITEMS.filter((item) => can(item.perm));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">H</div>
        <span className="text-lg font-semibold text-slate-800">HRMS</span>
        <button className="ml-auto text-slate-400 lg:hidden" onClick={onClose} aria-label="Close menu">
          <FiX size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) =>
          item.soon ? (
            <span
              key={item.to}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300"
              title="Coming soon"
            >
              <item.icon size={18} />
              {item.label}
              <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">SOON</span>
            </span>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          )
        )}
      </nav>
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-400">HRMS v1.0</div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
}
