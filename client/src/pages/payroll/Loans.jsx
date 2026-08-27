import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiTrash2 } from 'react-icons/fi';
import { loanService, employeeService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatCurrency } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';

const STATUS_TONE = { pending: 'amber', active: 'blue', rejected: 'red', closed: 'green', cancelled: 'gray' };
const now = new Date();
const money = (v) => (v != null && v !== '' ? formatCurrency(v) : '—');

export default function Loans() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['loans'], queryFn: () => loanService.list() });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['payroll'] });
  };

  const rejectMutation = useMutation({
    mutationFn: (id) => loanService.reject(id),
    onSuccess: (res) => { toast.success(res.message || 'Rejected.'); invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => loanService.remove(id),
    onSuccess: (res) => { toast.success(res.message || 'Loan forgiven & deleted.'); setDeleteTarget(null); invalidate(); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleteTarget(null); },
  });

  const columns = [
    { key: 'employee', header: 'Employee', render: (l) => <div><p className="font-medium text-slate-700">{l.first_name} {l.last_name}</p><p className="text-xs text-slate-400">{l.employee_code}</p></div> },
    { key: 'principal', header: 'Amount', align: 'right', render: (l) => formatCurrency(l.principal) },
    { key: 'interest_percent', header: 'Interest (p.a.)', align: 'right', render: (l) => (l.status === 'pending' ? '—' : `${l.interest_percent}% p.a.`) },
    { key: 'tenure_months', header: 'Tenure', align: 'right', render: (l) => (l.tenure_months ? `${l.tenure_months} mo` : '—') },
    { key: 'emi', header: 'EMI', align: 'right', render: (l) => money(l.emi) },
    { key: 'total_payable', header: 'Payable', align: 'right', render: (l) => money(l.total_payable) },
    { key: 'recovered', header: 'Recovered', align: 'right', render: (l) => money(l.recovered) },
    { key: 'reason', header: 'Reason', render: (l) => <span className="text-slate-500">{l.reason || '—'}</span> },
    { key: 'status', header: 'Status', render: (l) => <StatusBadge tone={STATUS_TONE[l.status]}>{l.status}</StatusBadge> },
    ...(can('loan:write') ? [{
      key: 'actions', header: '', align: 'right',
      render: (l) => (
        <div className="flex justify-end gap-1">
          {l.status === 'pending' && (
            <>
              <button title="Approve & set terms" onClick={() => setApproveTarget(l)} className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50"><FiCheck size={16} /></button>
              <button title="Reject" onClick={() => rejectMutation.mutate(l.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50"><FiX size={16} /></button>
            </>
          )}
          {(l.status === 'active' || l.status === 'closed' || l.status === 'rejected') && (
            <button title="Forgive & delete loan" onClick={() => setDeleteTarget(l)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50"><FiTrash2 size={16} /></button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Employee Loans"
        breadcrumbs={[{ label: 'Payroll', to: '/payroll' }, { label: 'Loans' }]}
        actions={can('loan:write') && <button className="btn-primary" onClick={() => setCreateOpen(true)}><FiPlus /> New Loan</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No loans yet" />
      </div>
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onDone={invalidate} />}
      {approveTarget && <ApproveModal loan={approveTarget} onClose={() => setApproveTarget(null)} onDone={invalidate} />}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Forgive & delete loan?"
        message={deleteTarget ? `This permanently deletes ${deleteTarget.first_name} ${deleteTarget.last_name || ''}'s loan of ${formatCurrency(deleteTarget.principal)}. The full outstanding balance is forgiven and the EMI is removed from any pending payroll. This cannot be undone.` : ''}
        confirmLabel="Forgive & delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/** Live EMI preview: simple interest at an ANNUAL rate, pro-rated over the tenure. */
function previewEmi(principal, interestPa, tenure) {
  const p = Number(principal); const i = Number(interestPa) || 0; const t = Number(tenure);
  if (!(p > 0) || !(t >= 1)) return null;
  const interest = p * (i / 100) * (t / 12);
  const payable = p + interest;
  return { interest, payable, emi: payable / t };
}

function ApproveModal({ loan, onClose, onDone }) {
  const [form, setForm] = useState({
    principal: String(loan.requested_amount ?? loan.principal ?? ''),
    interest_percent: '10',
    tenure_months: String(loan.tenure_months ?? '12'),
    start_month: now.getMonth() + 1,
    start_year: now.getFullYear(),
  });
  const mutation = useMutation({
    mutationFn: () => loanService.approve(loan.id, {
      principal: Number(form.principal), interest_percent: Number(form.interest_percent) || 0,
      tenure_months: Number(form.tenure_months), start_month: Number(form.start_month), start_year: Number(form.start_year),
    }),
    onSuccess: (res) => { toast.success(res.message || 'Approved.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const preview = previewEmi(form.principal, form.interest_percent, form.tenure_months);
  const valid = Number(form.principal) > 0 && Number(form.tenure_months) >= 1;
  return (
    <Modal open onClose={onClose} title={`Approve Loan — ${loan.first_name} ${loan.last_name || ''}`}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Approve & Activate
        </button></>}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Requested <span className="font-semibold text-slate-800">{formatCurrency(loan.requested_amount ?? loan.principal)}</span>
          {loan.tenure_months ? <span className="text-slate-400"> · {loan.tenure_months} mo preferred</span> : null}
          {loan.reason && <span className="text-slate-400"> · {loan.reason}</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Principal (₹)</label><input type="number" className="input" value={form.principal} onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))} /></div>
          <div><label className="label">Interest % <span className="font-normal text-slate-400">(p.a.)</span></label><input type="number" min="0" max="100" className="input" value={form.interest_percent} onChange={(e) => setForm((f) => ({ ...f, interest_percent: e.target.value }))} /></div>
          <div><label className="label">Tenure (months)</label><input type="number" min="1" max="120" className="input" value={form.tenure_months} onChange={(e) => setForm((f) => ({ ...f, tenure_months: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Start Mo.</label><input type="number" min="1" max="12" className="input" value={form.start_month} onChange={(e) => setForm((f) => ({ ...f, start_month: e.target.value }))} /></div>
            <div><label className="label">Year</label><input type="number" className="input" value={form.start_year} onChange={(e) => setForm((f) => ({ ...f, start_year: e.target.value }))} /></div>
          </div>
        </div>
        {preview && (
          <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Interest <b>{formatCurrency(preview.interest)}</b> ({form.interest_percent || 0}% p.a. × {form.tenure_months}mo) · Total payable <b>{formatCurrency(preview.payable)}</b> · EMI <b>{formatCurrency(preview.emi)}</b> × {form.tenure_months} months
          </div>
        )}
        <p className="text-xs text-slate-400">On approval the loan becomes active and its EMI is deducted from the employee's salary each month from the start period.</p>
      </div>
    </Modal>
  );
}

function CreateModal({ onClose, onDone }) {
  const empQ = useQuery({ queryKey: ['employees', 'picker'], queryFn: () => employeeService.list({ limit: 100, status: 'active' }) });
  const [form, setForm] = useState({ employee_id: '', principal: '', interest_percent: '0', tenure_months: '12', start_month: now.getMonth() + 1, start_year: now.getFullYear() });
  const mutation = useMutation({
    mutationFn: () => loanService.create({
      employee_id: form.employee_id, principal: Number(form.principal), interest_percent: Number(form.interest_percent) || 0,
      tenure_months: Number(form.tenure_months), start_month: Number(form.start_month), start_year: Number(form.start_year),
    }),
    onSuccess: (res) => { toast.success(res.message || 'Created.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const preview = previewEmi(form.principal, form.interest_percent, form.tenure_months);
  const valid = form.employee_id && Number(form.principal) > 0 && Number(form.tenure_months) >= 1;
  return (
    <Modal open onClose={onClose} title="New Employee Loan"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
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
          <div><label className="label">Principal</label><input type="number" className="input" value={form.principal} onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))} /></div>
          <div><label className="label">Interest % <span className="font-normal text-slate-400">(p.a.)</span></label><input type="number" className="input" value={form.interest_percent} onChange={(e) => setForm((f) => ({ ...f, interest_percent: e.target.value }))} /></div>
          <div><label className="label">Tenure (months)</label><input type="number" min="1" max="120" className="input" value={form.tenure_months} onChange={(e) => setForm((f) => ({ ...f, tenure_months: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Start Mo.</label><input type="number" min="1" max="12" className="input" value={form.start_month} onChange={(e) => setForm((f) => ({ ...f, start_month: e.target.value }))} /></div>
            <div><label className="label">Year</label><input type="number" className="input" value={form.start_year} onChange={(e) => setForm((f) => ({ ...f, start_year: e.target.value }))} /></div>
          </div>
        </div>
        {preview && (
          <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Interest <b>{formatCurrency(preview.interest)}</b> ({form.interest_percent || 0}% p.a. × {form.tenure_months}mo) · Total payable <b>{formatCurrency(preview.payable)}</b> · EMI <b>{formatCurrency(preview.emi)}</b> × {form.tenure_months} months
          </div>
        )}
      </div>
    </Modal>
  );
}
