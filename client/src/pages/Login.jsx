import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/apiClient.js';
import { landingPath, canOpenPath } from '../utils/permissions.js';
import Spinner from '../components/common/Spinner.jsx';

const schema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup.string().required('Password is required'),
  remember: yup.boolean(),
});

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema), defaultValues: { remember: true } });

  if (isAuthenticated) return <Navigate to={landingPath(user?.role)} replace />;

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const signedIn = await login(values);
      toast.success('Welcome back!');
      const from = location.state?.from?.pathname;
      // Only return to `from` if this role can actually open it; otherwise send
      // them to their own home so they never hit a 403 right after signing in.
      const target = from && canOpenPath(from, signedIn?.role) ? from : landingPath(signedIn?.role);
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl font-bold">H</div>
          <h1 className="text-2xl font-bold">HRMS</h1>
          <p className="text-sm text-brand-100">Employee & Payroll Management</p>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-semibold text-slate-800">Sign in</h2>
          <p className="mb-5 text-sm text-slate-500">Use your work account to continue.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" autoComplete="email" className="input pl-9" placeholder="you@company.com" {...register('email')} />
              </div>
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pl-9 pr-9"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-brand-600"
                  tabIndex={-1}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('remember')} />
              Remember me
            </label>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting && <Spinner size={16} className="text-white" />}
              Sign in
            </button>
          </form>

          <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600">Demo accounts</p>
            <p>superadmin@hrms.local · Super@123</p>
            <p>admin@hrms.local · Admin@123 &nbsp;|&nbsp; employee@hrms.local · Emp@12345</p>
            <p>hr@hrms.local · Hr@12345 &nbsp;|&nbsp; accounts@hrms.local · Acc@12345</p>
          </div>
        </div>
      </div>
    </div>
  );
}
