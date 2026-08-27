import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiDownload, FiLock, FiUnlock } from 'react-icons/fi';
import { payrollService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { PAYMENT_STATUS, formatCurrency, formatDate } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Spinner from '../../components/common/Spinner.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Manual deductions are for NON-attendance reasons only — absent, late, half-day,
// unpaid-leave and early-exit are deducted automatically from attendance + the pay policy.
const DEDUCTION_CATEGORIES = [
  { value: 'damage', label: 'Damage / Loss' },
  { value: 'fine', label: 'Fine / Penalty' },
  { value: 'recovery', label: 'Overpayment Recovery' },
  { value: 'cost', label: 'Cost Recovery' },
  { value: 'other', label: 'Other' },
];
const DED_LABEL = Object.fromEntries(DEDUCTION_CATEGORIES.map((c) => [c.value, c.label]));

// How the money disbursed on a voided payroll was accounted for (admin settlement).
const RESOLUTION_LABELS = {
  recovered: 'Recovered from employee',
  adjusted: 'Adjusted against future salary',
  written_off: 'Written off',
};


const Row = ({ label, value, strong }) => (
  <div className={`flex justify-between py-1 text-sm ${strong ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
    <span>{label}</span><span>{value}</span>
  </div>
);

export default function PayrollDetail({ id, onClose, onChange }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('breakdown');

  const detailQ = useQuery({ queryKey: ['payroll', 'detail', id], queryFn: () => payrollService.get(id) });
  const paymentsQ = useQuery({ queryKey: ['payroll', 'payments', id], queryFn: () => payrollService.payments(id), enabled: tab === 'payments' });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll', 'detail', id] });
    queryClient.invalidateQueries({ queryKey: ['payroll', 'payments', id] });
    onChange?.();
  };

  const lockMutation = useMutation({
    mutationFn: () => (detailQ.data.data.locked ? payrollService.unlock(id) : payrollService.lock(id)),
    onSuccess: (res) => { toast.success(res.message); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: () => payrollService.revoke(id),
    onSuccess: (res) => { toast.success(res.message || 'Payroll revoked.'); onChange?.(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const voidMutation = useMutation({
    mutationFn: () => payrollService.void(id),
    onSuccess: (res) => { toast.success(res.message || 'Payroll voided.'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const [settleForm, setSettleForm] = useState({ resolution: 'recovered', note: '', recovered_amount: '' });
  const settleMutation = useMutation({
    mutationFn: () => payrollService.settleVoid(id, settleForm),
    onSuccess: (res) => { toast.success(res.message); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const p = detailQ.data?.data;
  const isVoided = p && ['cancelled', 'refunded'].includes(p.payment_status);
  // Warn that manual bonus/deduction entries on this payroll will be wiped (they cascade
  // out with the row and must be re-added by hand if the month is regenerated).
  const adjWarning = () => {
    const list = p?.components || [];
    if (!list.length) return '';
    const bonus = list.filter((c) => c.kind === 'earning').reduce((s, c) => s + Number(c.amount || 0), 0);
    const ded = list.filter((c) => c.kind === 'deduction').reduce((s, c) => s + Number(c.amount || 0), 0);
    const parts = [];
    if (bonus) parts.push(`${formatCurrency(bonus)} bonus/incentive`);
    if (ded) parts.push(`${formatCurrency(ded)} deduction(s)`);
    return `\n\n⚠ This payroll has ${list.length} manual ${list.length > 1 ? 'entries' : 'entry'} (${parts.join(' + ')}) that will be permanently removed — you'll need to re-add ${list.length > 1 ? 'them' : 'it'} if you regenerate this month.`;
  };
  const confirmRevoke = () => {
    if (window.confirm(`Revoke this payroll? It will be permanently removed. Allowed only because no payment has been made.${adjWarning()}`)) revokeMutation.mutate();
  };
  const confirmVoid = () => {
    if (window.confirm(`Void this payroll? ${formatCurrency(p.paid_amount)} has already been paid out and will be flagged for manual recovery from the employee — the bank transfer cannot be reversed automatically.${adjWarning()}`)) voidMutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={p ? `Payroll · ${p.first_name} ${p.last_name || ''} · ${p.month}/${p.year}` : 'Payroll'}
      footer={
        p && (
          <div className="flex w-full items-center justify-between">
            <button className="btn-secondary" onClick={() => payrollService.openSlip(id).catch((e) => toast.error(errorMessage(e)))}>
              <FiDownload /> Slip
            </button>
            <div className="flex gap-2">
              {!isVoided && Number(p.paid_amount) <= 0 && can('payroll:revoke') && (
                <button className="btn-secondary text-red-600" onClick={confirmRevoke} disabled={revokeMutation.isPending}>Revoke</button>
              )}
              {!isVoided && Number(p.paid_amount) > 0 && can('payroll:void') && (
                <button className="btn-secondary text-red-600" onClick={confirmVoid} disabled={voidMutation.isPending}>Void</button>
              )}
              {can(p.locked ? 'payroll:unlock' : 'payroll:lock') && (
                <button className="btn-secondary" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}>
                  {p.locked ? <FiUnlock /> : <FiLock />} {p.locked ? 'Unlock' : 'Lock'}
                </button>
              )}
              <button className="btn-primary" onClick={onClose}>Close</button>
            </div>
          </div>
        )
      }
    >
      {detailQ.isLoading || !p ? (
        <div className="flex justify-center py-10"><Spinner size={26} /></div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge map={PAYMENT_STATUS} value={p.payment_status} />
            {p.locked ? <span className="text-xs text-slate-500">🔒 Locked</span> : null}
          </div>

          {isVoided && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-semibold text-red-700">This payroll was voided.</p>
              {Number(p.void_disbursed) > 0 && (
                <p className="mt-0.5 text-red-600">
                  {formatCurrency(p.void_disbursed)} had already been disbursed — the bank transfer cannot be reversed automatically and must be recovered from the employee.
                </p>
              )}
              {p.void_settled_at ? (
                <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-emerald-700">
                  ✓ Settled ({RESOLUTION_LABELS[p.void_resolution] || p.void_resolution}) — “{p.void_settle_note}”.
                  This month can now be regenerated.
                </p>
              ) : can('payroll:void') ? (
                <div className="mt-3 border-t border-red-200 pt-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Record how the disbursed money was settled to reopen this month for a corrected payroll:
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select className="input sm:w-56" value={settleForm.resolution}
                      onChange={(e) => setSettleForm((f) => ({ ...f, resolution: e.target.value }))}>
                      {Object.entries(RESOLUTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {settleForm.resolution === 'recovered' && (
                      <input className="input sm:w-44" type="number" min="0" step="0.01"
                        placeholder="Amount returned"
                        value={settleForm.recovered_amount}
                        onChange={(e) => setSettleForm((f) => ({ ...f, recovered_amount: e.target.value }))} />
                    )}
                    <input className="input flex-1" placeholder="Note (required) — e.g. returned excess in cash"
                      value={settleForm.note}
                      onChange={(e) => setSettleForm((f) => ({ ...f, note: e.target.value }))} />
                    <button className="btn-primary" disabled={!settleForm.note.trim() || settleMutation.isPending}
                      onClick={() => settleMutation.mutate()}>Mark Settled &amp; Unlock</button>
                  </div>
                  {settleForm.resolution === 'recovered' && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Employee keeps {formatCurrency(Math.max(0, Number(p.void_disbursed || 0) - Number(settleForm.recovered_amount || 0)))} — this carries forward as already-paid on the regenerated payroll. Leave blank if they returned the full {formatCurrency(p.void_disbursed)}.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Awaiting an administrator to settle the disbursed amount before this month can be regenerated.</p>
              )}
            </div>
          )}

          <div className="mb-3 flex gap-1 border-b border-slate-200">
            {['breakdown', 'pay', 'add', 'payments'].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}>
                {t === 'add' ? 'Bonus/Deduct' : t}
              </button>
            ))}
          </div>

          {tab === 'breakdown' && (
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-emerald-600">Earnings</p>
                <Row label="Basic" value={formatCurrency(p.basic)} />
                <Row label="House Allowance" value={formatCurrency(p.house_allowance)} />
                <Row label="Medical" value={formatCurrency(p.medical_allowance)} />
                <Row label="Travel" value={formatCurrency(p.travel_allowance)} />
                <Row label={`Overtime${Number(p.overtime_hours) > 0 ? ` (${Number(p.overtime_hours)}h)` : ''}`} value={formatCurrency(p.overtime_amount)} />
                <Row label="Bonus/Incentives" value={formatCurrency(p.bonus_total)} />
                <Row label="Gross" value={formatCurrency(p.gross_amount)} strong />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-red-600">Deductions</p>
                <Row label="Tax" value={formatCurrency(p.tax)} />
                <Row label="PF" value={formatCurrency(p.pf)} />
                <Row label="ESI" value={formatCurrency(p.esi)} />
                {Number(p.advance_recovery) > 0.005 && <Row label="Advance Recovery" value={formatCurrency(p.advance_recovery)} />}
                {Number(p.loan_recovery) > 0.005 && <Row label="Loan Recovery" value={formatCurrency(p.loan_recovery)} />}
                {(() => {
                  // Attendance-driven penalties, shown WITH their basis so it's clear where
                  // the amount comes from (e.g. "1 unpaid day × ₹3,846/day"). Automatic —
                  // that's why they never appear in the manual Bonus/Deduction history.
                  const days = Number(p.working_days) || 0;
                  const perDay = days > 0 ? Number(p.basic) / days : 0;
                  const absentDays = Number(p.absent_days || 0);
                  const unpaidDays = Number(p.unpaid_leave_days || 0);
                  const dLabel = (n, u) => `${n} ${u}${n !== 1 ? 's' : ''}`;
                  // An absence and an unpaid leave are different things: only unpaid leave shows
                  // in the Leave section — an absence never does. Label by what actually occurred.
                  const absLabel = absentDays > 0 && unpaidDays > 0 ? 'Absent + Unpaid Leave'
                    : unpaidDays > 0 ? 'Unpaid Leave' : 'Absent';
                  const absNote = [absentDays > 0 && dLabel(absentDays, 'absent day'), unpaidDays > 0 && dLabel(unpaidDays, 'unpaid day')].filter(Boolean).join(' + ');
                  return (
                    <>
                      {Number(p.absent_deduction) > 0.005 && (
                        <Row label={<span title={`Automatic — ${absNote || 'attendance'} × ${formatCurrency(perDay)}/day (basic ÷ ${days} days)`}>
                          {absLabel} <span className="text-[10px] font-normal text-slate-400">{absNote || 'attendance'}</span>
                        </span>} value={formatCurrency(p.absent_deduction)} />
                      )}
                      {Number(p.halfday_deduction) > 0.005 && (
                        <Row label={<span title={`Automatic — ${Number(p.half_days) || 0} half-day(s)`}>
                          Half-day <span className="text-[10px] font-normal text-slate-400">{Number(p.half_days) ? dLabel(Number(p.half_days), 'half-day') : 'attendance'}</span>
                        </span>} value={formatCurrency(p.halfday_deduction)} />
                      )}
                      {Number(p.late_penalty) > 0.005 && (
                        <Row label={<span title="Automatic — late arrival penalty from attendance">
                          Late Penalty <span className="text-[10px] font-normal text-slate-400">attendance</span>
                        </span>} value={formatCurrency(p.late_penalty)} />
                      )}
                    </>
                  );
                })()}
                {/* Every manual deduction as its own attributed line — label, category and (on
                    hover) the note + who added it, so an admin can always see its purpose. */}
                {(p.components || []).filter((c) => c.kind === 'deduction').map((c) => (
                  <Row key={c.id} label={
                    <span title={[c.remarks, c.created_by_name && `added by ${c.created_by_name}`].filter(Boolean).join(' · ') || 'Manual deduction'}>
                      {c.label} <span className="text-[10px] font-normal text-slate-400">manual{c.category && c.category !== 'other' ? ` · ${DED_LABEL[c.category] || c.category}` : ''}</span>
                    </span>
                  } value={formatCurrency(c.amount)} />
                ))}
                <Row label="Total Deductions" value={formatCurrency(p.total_deductions)} strong />
              </div>
              <div className="mt-3 sm:col-span-2 border-t border-slate-200 pt-2">
                <Row label="Net Salary" value={formatCurrency(p.net_amount)} strong />
                <Row label="Previous Pending" value={formatCurrency(p.previous_pending)} />
                <Row label="Paid" value={formatCurrency(p.paid_amount)} />
                {p.advances_paid?.length > 0 && (
                  <div className="flex justify-between py-1 text-sm text-amber-700">
                    <span title={p.advances_paid.map((a) => `${formatCurrency(a.paid_amount ?? a.amount)}${a.reason ? ` — ${a.reason}` : ''}`).join('\n')}>
                      ↳ incl. advance paid early
                    </span>
                    <span>{formatCurrency(p.advances_paid.reduce((s, a) => s + Number(a.paid_amount ?? a.amount ?? 0), 0))}</span>
                  </div>
                )}
                <Row label="Remaining (this month)" value={formatCurrency(p.remaining_amount)} />
                <Row label="Total Outstanding" value={formatCurrency(p.outstanding)} strong />
                <div className="mt-2 text-xs text-slate-400">
                  Attendance — present {Number(p.present_days)} / working {Number(p.working_days)} · OT {Number(p.overtime_hours)}h
                </div>
              </div>
            </div>
          )}

          {tab === 'pay' && <PayForm payroll={p} onDone={refresh} />}
          {tab === 'add' && <ComponentForm payroll={p} onDone={refresh} />}
          {tab === 'payments' && <PaymentsList query={paymentsQ} />}
        </div>
      )}
    </Modal>
  );
}

function PayForm({ payroll, onDone }) {
  const { can } = useAuth();
  const remaining = Number(payroll.remaining_amount);
  const [form, setForm] = useState({ amount: '', payment_method: 'bank_transfer', transaction_id: '', reference_number: '', remarks: '' });
  const mutation = useMutation({
    mutationFn: () => payrollService.pay(payroll.id, { ...clean(form), amount: Number(form.amount) }),
    onSuccess: (res) => { toast.success(res.message || 'Payment recorded.'); onDone(); setForm((f) => ({ ...f, amount: '', transaction_id: '' })); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!can('payment:write')) return <p className="py-6 text-center text-sm text-slate-400">You don’t have permission to record payments.</p>;
  if (remaining <= 0) return <p className="py-6 text-center text-sm text-emerald-600">This payroll is fully paid.</p>;

  const priorUnpaid = Number(payroll.prior_unpaid) || 0;
  const priorMonths = payroll.prior_unpaid_months || [];

  return (
    <div className="space-y-3">
      {priorUnpaid > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <p className="font-semibold text-amber-800">⚠ Earlier months are still unpaid</p>
          <p className="mt-0.5 text-amber-700">
            {payroll.first_name} has <span className="font-semibold">{formatCurrency(priorUnpaid)}</span> in arrears from{' '}
            {priorMonths.map((m) => `${MONTHS[m.month - 1]} ${m.year}`).join(', ')}. You can still pay this month — the older dues stay
            tracked in Outstanding — but consider clearing them first.
          </p>
        </div>
      )}
      <p className="text-sm text-slate-500">Remaining: <span className="font-semibold text-red-600">{formatCurrency(remaining)}</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Amount</label><input type="number" step="0.01" max={remaining} className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
            {['bank_transfer', 'cash', 'upi', 'cheque', 'card', 'online', 'other'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div><label className="label">Transaction ID</label><input className="input" value={form.transaction_id} onChange={(e) => setForm((f) => ({ ...f, transaction_id: e.target.value }))} /></div>
        <div><label className="label">Reference</label><input className="input" value={form.reference_number} onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))} /></div>
      </div>
      <div><label className="label">Remarks</label><input className="input" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
      <button className="btn-primary w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !(Number(form.amount) > 0)}>
        {mutation.isPending && <Spinner size={16} className="text-white" />} Pay {form.amount ? formatCurrency(form.amount) : ''}
      </button>
    </div>
  );
}

function ComponentForm({ payroll, onDone }) {
  const { can } = useAuth();
  const [form, setForm] = useState({ kind: 'earning', category: '', label: '', amount: '' });
  const isDeduction = form.kind === 'deduction';
  const mutation = useMutation({
    mutationFn: () => {
      const category = isDeduction ? (form.category || 'other') : form.category;
      return payrollService.addComponent(payroll.id, { kind: form.kind, category, label: form.label.trim(), amount: Number(form.amount) });
    },
    onSuccess: (res) => { toast.success(res.message || 'Added.'); onDone(); setForm((f) => ({ ...f, label: '', amount: '' })); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Adding is only allowed while the payroll is unpaid, unlocked and the user has
  // write access — but the HISTORY below is ALWAYS shown (read-only) so an admin can
  // see exactly what was deducted/added, its purpose, and by whom, even after payment.
  const blockedReason = !can('payroll:write')
    ? 'You don’t have permission to add bonuses or deductions.'
    : payroll.locked
      ? 'Payroll is locked — unlock to add bonuses or deductions.'
      : Number(payroll.paid_amount) > 0
        ? 'Payments already made — bonuses and deductions can’t be changed.'
        : null;
  const canAdd = !blockedReason;

  // A note (label) is required for every entry — including deductions — so a vague/blank
  // "Other" deduction can't be saved. Amount and category are required too.
  const canSubmit = Number(form.amount) > 0 && form.label.trim() && form.category;
  const setKind = (kind) => setForm((f) => ({ ...f, kind, category: kind === 'deduction' ? (f.category && DED_LABEL[f.category] ? f.category : 'damage') : '', label: '' }));

  return (
    <div className="space-y-3">
      {canAdd ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.kind} onChange={(e) => setKind(e.target.value)}>
                <option value="earning">Bonus / Earning</option>
                <option value="deduction">Deduction (penalty)</option>
              </select>
            </div>
            <div><label className="label">Amount</label><input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            {isDeduction ? (
              <>
                <div>
                  <label className="label">Reason</label>
                  <select className="input" value={form.category || 'damage'} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {DEDUCTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Note / reason<span className="text-red-500"> *</span></label><input className="input" placeholder="e.g. Uniform damage, cash shortage" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></div>
              </>
            ) : (
              <>
                <div><label className="label">Category</label><input className="input" placeholder="e.g. festival_bonus" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></div>
                <div><label className="label">Label</label><input className="input" placeholder="e.g. Festival Bonus" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></div>
              </>
            )}
          </div>
          {isDeduction && (
            <p className="text-xs text-slate-400">
              For <span className="font-medium">non-attendance</span> deductions only (damage, fines, recoveries, one-off costs). Absent, late, half-day, unpaid-leave and early-exit are deducted <span className="font-medium">automatically from attendance</span> — set those in the pay policy, not here.
            </p>
          )}
          <button className="btn-primary w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending && <Spinner size={16} className="text-white" />} Add {isDeduction ? 'deduction' : 'bonus'}
          </button>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 py-3 text-center text-xs text-slate-500">{blockedReason}</p>
      )}

      <ComponentHistory components={payroll.components} />
    </div>
  );
}

/** Read-only log of every bonus/deduction on a payroll — shows the purpose (label),
 *  category, amount and who added it. Always visible, even on a paid/locked payroll. */
function ComponentHistory({ components }) {
  if (!components?.length) {
    return <p className="mt-2 text-center text-xs text-slate-400">No bonuses or deductions added for this month.</p>;
  }
  return (
    <div>
      <p className="mb-1 mt-2 text-xs font-semibold uppercase text-slate-500">Bonus / Deduction History</p>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        {components.map((c) => (
          <div key={c.id} className="flex items-start justify-between px-2.5 py-1.5">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${c.kind === 'earning' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {c.kind === 'earning' ? 'Bonus' : (DED_LABEL[c.category] || 'Deduction')}
                </span>
                <span className="text-slate-700">{c.label}</span>
              </div>
              {(c.created_by_name || c.created_at) && (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {c.created_by_name ? `by ${c.created_by_name}` : ''}
                  {c.created_by_name && c.created_at ? ' · ' : ''}
                  {c.created_at ? formatDate(c.created_at) : ''}
                </p>
              )}
            </div>
            <span className={`whitespace-nowrap ${c.kind === 'earning' ? 'text-emerald-700' : 'text-red-700'}`}>
              {c.kind === 'earning' ? '+' : '−'}{formatCurrency(c.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsList({ query }) {
  if (query.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const payments = query.data?.data || [];
  if (!payments.length) return <p className="py-8 text-center text-sm text-slate-400">No payments yet.</p>;
  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-slate-700">{formatCurrency(p.amount)} · {p.payment_method?.replace('_', ' ')}</p>
            <p className="text-xs text-slate-400">{formatDate(p.payment_date)}{p.transaction_id ? ` · ${p.transaction_id}` : ''}{p.created_by_name ? ` · by ${p.created_by_name}` : ''}</p>
          </div>
          <span className="text-xs text-slate-400">rem {formatCurrency(p.remaining_after)}</span>
        </div>
      ))}
    </div>
  );
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}
