import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiDollarSign } from 'react-icons/fi';
import { advanceService, employeeService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatCurrency, formatDate } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Spinner from '../../components/common/Spinner.jsx';

const STATUS_TONE = { pending: 'amber', approved: 'green', paid: 'blue', rejected: 'red', closed: 'gray' };
const today = () => new Date().toISOString().slice(0, 10);

export default function Advances() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['advances'], queryFn: () => advanceService.list() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['advances'] });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }) => advanceService.decide(id, status),
    onSuccess: (res) => { toast.success(res.message || 'Done.'); invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns = [
    { key: 'employee', header: 'Employee', render: (a) => <div><p className="font-medium text-slate-700">{a.first_name} {a.last_name}</p><p className="text-xs text-slate-400">{a.employee_code}</p></div> },
    { key: 'amount', header: 'Requested', align: 'right', render: (a) => formatCurrency(a.amount) },
    { key: 'paid_amount', header: 'Paid', align: 'right', render: (a) => (Number(a.paid_amount) > 0 ? formatCurrency(a.paid_amount) : '—') },
    { key: 'reason', header: 'Reason', render: (a) => <span className="text-slate-500">{a.reason || '—'}</span> },
    { key: 'request_date', header: 'Requested On', render: (a) => formatDate(a.request_date) },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge tone={STATUS_TONE[a.status]}>{a.status}</StatusBadge> },
    ...(can('advance:write') || can('advance:approve') ? [{
      key: 'actions', header: '', align: 'right',
      render: (a) => ['pending', 'approved'].includes(a.status) && (
        <div className="flex justify-end gap-1">
          {can('advance:write') && (
            <button title="Pay advance" onClick={() => setPayTarget(a)} className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50"><FiDollarSign size={16} /></button>
          )}
          {can('advance:approve') && a.status === 'pending' && (
            <>
              <button title="Approve" onClick={() => decideMutation.mutate({ id: a.id, status: 'approved' })} className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50"><FiCheck size={16} /></button>
              <button title="Reject" onClick={() => decideMutation.mutate({ id: a.id, status: 'rejected' })} className="rounded-md p-1.5 text-red-500 hover:bg-red-50"><FiX size={16} /></button>
            </>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Salary Advances"
        breadcrumbs={[{ label: 'Payroll', to: '/payroll' }, { label: 'Advances' }]}
        actions={can('advance:write') && <button className="btn-primary" onClick={() => setCreateOpen(true)}><FiPlus /> New Advance</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No advances yet" />
      </div>
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onDone={invalidate} />}
      {payTarget && <PayModal advance={payTarget} onClose={() => setPayTarget(null)} onDone={invalidate} />}
    </div>
  );
}

function PayModal({ advance, onClose, onDone }) {
  const [form, setForm] = useState({ amount: String(advance.amount ?? ''), payment_method: 'bank_transfer', remarks: '' });
  const mutation = useMutation({
    mutationFn: () => advanceService.pay(advance.id, { amount: Number(form.amount), payment_method: form.payment_method, remarks: form.remarks || undefined }),
    onSuccess: (res) => { toast.success(res.message || 'Advance paid.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const valid = Number(form.amount) > 0;
  return (
    <Modal open onClose={onClose} title={`Pay Advance — ${advance.first_name} ${advance.last_name || ''}`}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Pay Advance
        </button></>}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Requested <span className="font-semibold text-slate-800">{formatCurrency(advance.amount)}</span>
          {advance.reason && <span className="text-slate-400"> · {advance.reason}</span>}
        </div>
        <div>
          <label className="label">Amount to Pay (₹)</label>
          <input type="number" min="1" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-400">You may pay less, exactly, or more than the requested amount.</p>
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
            {['bank_transfer', 'cash', 'upi', 'cheque', 'card', 'online', 'other'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Remarks</label>
          <input className="input" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-400">The paid amount is applied to this employee's current payroll, moving it to <b>partially paid</b> (or paid).</p>
      </div>
    </Modal>
  );
}

function CreateModal({ onClose, onDone }) {
  const empQ = useQuery({ queryKey: ['employees', 'picker'], queryFn: () => employeeService.list({ limit: 100, status: 'active' }) });
  const [form, setForm] = useState({ employee_id: '', amount: '', request_date: today(), recovery_per_month: '', reason: '' });
  const mutation = useMutation({
    mutationFn: () => advanceService.create({ ...clean(form), amount: Number(form.amount), recovery_per_month: Number(form.recovery_per_month) || 0 }),
    onSuccess: (res) => { toast.success(res.message || 'Created.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <Modal open onClose={onClose} title="New Salary Advance"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.employee_id || !(Number(form.amount) > 0)}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Create
        </button></>}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Employee</label>
          <select className="input" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select employee…</option>
            {(empQ.data?.data || []).map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input type="number" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          <div><label className="label">Recovery / Month</label><input type="number" className="input" value={form.recovery_per_month} onChange={(e) => setForm((f) => ({ ...f, recovery_per_month: e.target.value }))} /></div>
        </div>
        <div><label className="label">Request Date</label><input type="date" className="input" value={form.request_date} onChange={(e) => setForm((f) => ({ ...f, request_date: e.target.value }))} /></div>
        <div><label className="label">Reason</label><input className="input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}
