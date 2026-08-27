import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { companyService } from '../services/index.js';
import { errorMessage } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Spinner from '../components/common/Spinner.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import { Input, Select, Options } from '../components/forms/fields.jsx';

export default function Settings() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = can('company:update');

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['company'], queryFn: () => companyService.get() });
  const { register, handleSubmit, reset, watch } = useForm();

  useEffect(() => {
    if (data?.data) reset(data.data);
  }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => companyService.update(values),
    onSuccess: (res) => {
      toast.success(res.message || 'Saved.');
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Editable per-day pay policy row: employee is paid X% of the day, the rest is deducted.
  const policyRow = (label, field) => {
    const paid = Number(watch(field));
    const p = Number.isFinite(paid) ? Math.max(0, Math.min(100, paid)) : 0;
    return (
      <tr key={field}>
        <td className="py-2 pr-4 text-slate-700">{label}</td>
        <td className="py-2 pr-4 text-right">
          <input type="number" step="5" min={0} max={100} disabled={!canEdit}
            className="input ml-auto w-24 text-right" {...register(field)} />
        </td>
        <td className="py-2 text-right font-medium text-red-600">−{Math.round((100 - p) * 100) / 100}%</td>
      </tr>
    );
  };

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (isError) return <ErrorState message="Failed to load company settings." onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Company Settings"
        subtitle="Organization profile, payroll cycle and working calendar."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Company Settings' }]}
      />

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Organization</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company Name" disabled={!canEdit} {...register('company_name')} />
            <Input label="Email" disabled={!canEdit} {...register('email')} />
            <Input label="Phone" disabled={!canEdit} {...register('phone')} />
            <Input label="Website" disabled={!canEdit} {...register('website')} />
            <Input label="GST Number" disabled={!canEdit} {...register('gst_number')} />
            <Input label="Address" disabled={!canEdit} className="sm:col-span-2" {...register('address')} />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Payroll & Calendar</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Currency" disabled={!canEdit} {...register('currency')} />
            <Input label="Timezone" disabled={!canEdit} {...register('timezone')} />
            <Select label="Salary Cycle" disabled={!canEdit} {...register('salary_cycle')}>
              <Options map={{ monthly: 'Monthly', weekly: 'Weekly', daily: 'Daily', hourly: 'Hourly' }} includeEmpty={false} />
            </Select>
            <Input label="Working Days / Week" type="number" min={1} max={7} disabled={!canEdit} {...register('working_days')} />
            <Input label="Default Leave Count" type="number" min={0} disabled={!canEdit} {...register('default_leave_count')} />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Working Shift{data?.data?.shift_name ? ` · ${data.data.shift_name}` : ''}</h3>
          <p className="mb-4 text-xs text-slate-400">
            Late arrival and overtime are calculated from this shift. This is the single source of truth for working hours.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Shift Start" type="time" disabled={!canEdit} {...register('shift_start')} />
            <Input label="Shift End" type="time" disabled={!canEdit} {...register('shift_end')} />
            <Input label="Grace (minutes)" type="number" min={0} max={240} disabled={!canEdit} {...register('grace_minutes')} />
            <Input label="Overtime Rate (× hourly)" type="number" step="0.25" min={0} max={10} disabled={!canEdit} {...register('overtime_multiplier')} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Overtime pay = overtime hours × hourly wage × this rate. 1.0 = normal hourly, 1.5 = time-and-a-half. Added to salary automatically each payroll.
          </p>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Attendance Pay Policy</h3>
          <p className="mb-4 text-xs text-slate-400">
            For each attendance status, set how much of a day's salary the employee is paid — the rest is deducted automatically when payroll is generated.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Attendance status</th>
                  <th className="py-2 pr-4 text-right">Paid % of day</th>
                  <th className="py-2 text-right">Deducted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[['Present', 'present'], ['Work from home', 'wfh'], ['Paid leave', 'paid_leave'], ['Holiday', 'holiday'], ['Weekend', 'weekend']].map(([lbl, k]) => (
                  <tr key={k}>
                    <td className="py-2 pr-4 text-slate-600">{lbl}</td>
                    <td className="py-2 pr-4 text-right text-slate-500">100%</td>
                    <td className="py-2 text-right text-emerald-600">fully paid</td>
                  </tr>
                ))}
                {policyRow('Half day', 'pay_pct_half_day')}
                {policyRow('Absent', 'pay_pct_absent')}
                {policyRow('Unpaid leave', 'pay_pct_unpaid_leave')}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Late penalty (₹ / minute)" type="number" step="0.5" min={0} disabled={!canEdit} {...register('late_penalty_per_min')} />
            <Input label="Early-exit penalty (₹ / minute)" type="number" step="0.5" min={0} disabled={!canEdit} {...register('early_exit_penalty_per_min')} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Present, WFH, paid leave, holiday and weekend are always fully paid. Half-day, absent and unpaid-leave deduct a share of the day's salary (per-day basic × the deducted %). Late and early-exit are per-minute penalties on a worked day, measured against the shift + grace.
          </p>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Spinner size={16} className="text-white" />} Save Settings
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
