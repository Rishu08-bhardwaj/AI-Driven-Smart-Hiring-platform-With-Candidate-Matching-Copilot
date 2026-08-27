import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">The page you’re looking for doesn’t exist or was moved.</p>
      <Link to="/dashboard" className="btn-primary mt-5">Back to dashboard</Link>
    </div>
  );
}
