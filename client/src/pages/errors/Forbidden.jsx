import { Link } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import { landingPath } from '../../utils/permissions.js';

export default function Forbidden() {
  const { user } = useAuth();
  const home = landingPath(user?.role);
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
        <FiLock size={30} />
      </div>
      <h1 className="text-xl font-semibold text-slate-800">Access denied</h1>
      <p className="mt-1 text-sm text-slate-500">Your role doesn’t have permission to view this page.</p>
      <Link to={home === '/403' ? '/login' : home} className="btn-primary mt-5">
        {home === '/me/dashboard' ? 'Back to my dashboard' : 'Back to dashboard'}
      </Link>
    </div>
  );
}
