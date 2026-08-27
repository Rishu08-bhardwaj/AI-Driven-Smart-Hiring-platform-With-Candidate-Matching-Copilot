import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiClock, FiCalendar, FiDollarSign, FiBell, FiPlus } from 'react-icons/fi';
import { meService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatCurrency, formatDate, PAYMENT_STATUS } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

const ADV_TONE = { pending: 'amber', approved: 'green', paid: 'blue', rejected: 'red', closed: 'gray' };
const LOAN_TONE = { pending: 'amber', active: 'blue', rejected: 'red', closed: 'green', cancelled: 'gray' };

export default function MyDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['me', 'dashboard'], queryFn: () => meService.dashboard() });
  const advQ = useQuery({ queryKey: ['me', 'advances'], queryFn: () => meService.advances() });
  const loanQ = useQuery({ queryKey: ['me', 'loans'], queryFn: () => meService.loans() });
  const [advOpen, setAdvOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (isError) return <ErrorState message="Failed to load your dashboard." onRetry={refetch} />;

  const d = data?.data || {};
  const advances = advQ.data?.data || [];
  const loans = loanQ.data?.data || [];
  const totalBalance = (d.leaveBalances || []).reduce((sum, b) => sum + (Number(b.allocated) - Number(b.used)), 0);

  return (
    <div>
      <PageHeader
        title={`Hello, ${d.employee?.name || ''}`}
        subtitle={`${d.employee?.designation || ''}${d.employee?.department ? ` · ${d.employee.department}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setLoanOpen(true)}><FiPlus /> Request Loan</button>
            <button className="btn-primary" onClick={() => setAdvOpen(true)}><FiPlus /> Request Salary Advance</button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today" value={d.todayAttendance?.status ? d.todayAttendance.status.replace('_', ' ') : 'Not marked'} icon={FiClock} tone="blue" hint={d.todayAttendance?.working_hours ? `${d.todayAttendance.working_hours} hrs` : undefined} />
        <StatCard label="Leave Balance" value={`${totalBalance} days`} icon={FiCalendar} tone="green" />
        <StatCard label="Latest Salary" value={d.salarySummary ? formatCurrency(d.salarySummary.net_amount) : '—'} icon={FiDollarSign} tone="violet" hint={d.salarySummary ? PAYMENT_STATUS[d.salarySummary.payment_status]?.label : undefined} />
        <StatCard label="Notifications" value={(d.recentNotifications || []).filter((n) => !n.is_read).length} icon={FiBell} tone="amber" hint="unread" />
      </div>

      {/* This month's salary breakdown */}
      {d.salarySummary && <SalaryBreakdown s={d.salarySummary} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leave balances */}
        <div className="card">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Leave Balances</div>
          <div className="divide-y divide-slate-50">
            {(d.leaveBalances || []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No leave balances allocated.</p>
            ) : (
              d.leaveBalances.map((b) => (
                <div key={b.id || b.leave_type_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-600">{b.leave_type_name || b.name || 'Leave'}</span>
                  <span className="font-medium text-slate-700">{Number(b.allocated) - Number(b.used)} / {b.allocated}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Salary advances */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-700">My Salary Advances</span>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setAdvOpen(true)}>Request</button>
          </div>
          <div className="divide-y divide-slate-50">
            {advances.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No advance requests yet.</p>
            ) : (
              advances.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{formatCurrency(a.status === 'paid' ? a.paid_amount : a.amount)}</p>
                    <p className="text-xs text-slate-400">{a.reason || '—'} · {formatDate(a.request_date)}</p>
                  </div>
                  <StatusBadge tone={ADV_TONE[a.status]}>{a.status}</StatusBadge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Loans */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-700">My Loans</span>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setLoanOpen(true)}>Request</button>
          </div>
          <div className="divide-y divide-slate-50">
            {loans.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No loan requests yet.</p>
            ) : (
              loans.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{formatCurrency(l.principal)}{l.status === 'active' && l.emi ? <span className="text-xs font-normal text-slate-400"> · EMI {formatCurrency(l.emi)} × {l.tenure_months}mo @ {l.interest_percent}% p.a.</span> : l.tenure_months ? <span className="text-xs font-normal text-slate-400"> · {l.tenure_months}mo requested</span> : null}</p>
                    <p className="text-xs text-slate-400">{l.reason || '—'}{l.status === 'active' ? ` · recovered ${formatCurrency(l.recovered)}` : ''}</p>
                  </div>
                  <StatusBadge tone={LOAN_TONE[l.status]}>{l.status}</StatusBadge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming holidays */}
        <div className="card">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Upcoming Holidays</div>
          <div className="divide-y divide-slate-50">
            {(d.upcomingHolidays || []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No upcoming holidays.</p>
            ) : (
              d.upcomingHolidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-600">{h.name}</span>
                  <span className="text-slate-400">{formatDate(h.holiday_date)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent notifications */}
        <div className="card">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Recent Notifications</div>
          <div className="divide-y divide-slate-50">
            {(d.recentNotifications || []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications.</p>
            ) : (
              d.recentNotifications.map((n) => (
                <div key={n.id} className={`px-4 py-2.5 ${n.is_read ? '' : 'bg-brand-50/40'}`}>
                  <p className="text-sm font-medium text-slate-700">{n.title}</p>
                  {n.description && <p className="text-xs text-slate-500">{n.description}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {advOpen && <RequestAdvanceModal onClose={() => setAdvOpen(false)} />}
      {loanOpen && <RequestLoanModal onClose={() => setLoanOpen(false)} />}
    </div>
  );
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function SalaryBreakdown({ s }) {
  const bonusNet = Number(s.bonus_total || 0) - Number(s.other_deductions || 0);
  const tiles = [
    { label: 'Actual Salary', value: formatCurrency(s.salary_amount), tone: 'text-slate-800', hint: 'base pay' },
    { label: 'EMI (loan)', value: Number(s.loan_recovery) > 0 ? `−${formatCurrency(s.loan_recovery)}` : '—', tone: 'text-amber-600', hint: 'deducted' },
    {
      label: 'Bonus / Deduction',
      value: bonusNet === 0 ? '—' : `${bonusNet > 0 ? '+' : '−'}${formatCurrency(Math.abs(bonusNet))}`,
      tone: bonusNet >= 0 ? 'text-emerald-600' : 'text-red-600',
      hint: `bonus ${formatCurrency(s.bonus_total || 0)} · ded ${formatCurrency(s.other_deductions || 0)}`,
    },
    { label: 'Total Earning (Net)', value: formatCurrency(s.net_amount), tone: 'text-brand-700', hint: 'take-home' },
  ];
  return (
    <div className="mb-6 card">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-sm font-semibold text-slate-700">This Month&apos;s Salary — {MONTHS[s.month]} {s.year}</span>
        <span className="text-xs text-slate-400">{PAYMENT_STATUS[s.payment_status]?.label || s.payment_status}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className={`mt-0.5 text-lg font-semibold ${t.tone}`}>{t.value}</p>
            <p className="text-[11px] text-slate-400">{t.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestLoanModal({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ amount: '', tenure_months: '12', reason: '' });
  const mutation = useMutation({
    mutationFn: () => meService.requestLoan({ amount: Number(form.amount), tenure_months: Number(form.tenure_months), reason: form.reason.trim() }),
    onSuccess: (res) => {
      toast.success(res.message || 'Loan request submitted.');
      queryClient.invalidateQueries({ queryKey: ['me', 'loans'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const valid = Number(form.amount) > 0 && Number(form.tenure_months) >= 1 && form.reason.trim().length > 0;
  return (
    <Modal open onClose={onClose} title="Request Loan"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Submit Request
        </button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Loan Amount (₹)</label>
            <input type="number" min="1" className="input" placeholder="e.g. 120000" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="label">Preferred Tenure (months)</label>
            <input type="number" min="1" max="120" className="input" value={form.tenure_months} onChange={(e) => setForm((f) => ({ ...f, tenure_months: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Reason</label>
          <textarea className="input" rows={3} placeholder="What is this loan for?" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-400">The accountant reviews your request and sets the interest rate & final tenure. Once approved, the EMI is deducted from your salary each month.</p>
      </div>
    </Modal>
  );
}

function RequestAdvanceModal({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ amount: '', reason: '' });
  const mutation = useMutation({
    mutationFn: () => meService.requestAdvance({ amount: Number(form.amount), reason: form.reason.trim() }),
    onSuccess: (res) => {
      toast.success(res.message || 'Advance request submitted.');
      queryClient.invalidateQueries({ queryKey: ['me', 'advances'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const valid = Number(form.amount) > 0 && form.reason.trim().length > 0;
  return (
    <Modal open onClose={onClose} title="Request Salary Advance"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Submit Request
        </button></>}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Amount (₹)</label>
          <input type="number" min="1" className="input" placeholder="e.g. 15000" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
        <div>
          <label className="label">Reason</label>
          <textarea className="input" rows={3} placeholder="Why do you need this advance?" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-400">Your request goes to the accountant, who reviews and disburses it. A paid advance appears against your current payroll.</p>
      </div>
    </Modal>
  );
}
