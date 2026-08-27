import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiMenu, FiBell, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationService } from '../../services/index.js';
import { ROLES } from '../../constants/index.js';
import Avatar from '../common/Avatar.jsx';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const ref = useRef(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list({ limit: 8 }),
    refetchInterval: 60_000,
  });
  const notifications = data?.data || [];
  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setMenuOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <button className="text-slate-500 lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <FiMenu size={22} />
      </button>

      <div className="ml-auto flex items-center gap-2" ref={ref}>
        {/* Notifications */}
        <div className="relative">
          <button
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => { setBellOpen((v) => !v); setMenuOpen(false); }}
            aria-label="Notifications"
          >
            <FiBell size={19} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Notifications</div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`border-b border-slate-50 px-4 py-2.5 ${n.is_read ? '' : 'bg-brand-50/40'}`}>
                      <p className="text-sm font-medium text-slate-700">{n.title}</p>
                      {n.description && <p className="text-xs text-slate-500">{n.description}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"
            onClick={() => { setMenuOpen((v) => !v); setBellOpen(false); }}
          >
            <Avatar name={user?.name} size={32} />
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{user?.name}</span>
            <FiChevronDown size={16} className="text-slate-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <span className="mt-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                  {ROLES[user?.role] || user?.role}
                </span>
              </div>
              <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                <FiLogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
