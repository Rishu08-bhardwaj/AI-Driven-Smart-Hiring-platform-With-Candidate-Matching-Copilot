import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FullPageLoader from '../components/common/FullPageLoader.jsx';

/**
 * Guards a route subtree. Redirects unauthenticated users to /login and
 * users lacking the required permission(s) to /403.
 */
export default function ProtectedRoute({ children, permissions }) {
  const { isAuthenticated, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (permissions?.length && !can(...permissions)) return <Navigate to="/403" replace />;
  return children;
}
