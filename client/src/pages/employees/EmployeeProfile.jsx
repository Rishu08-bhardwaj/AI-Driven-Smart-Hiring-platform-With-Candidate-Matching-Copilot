import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiEdit2, FiPhone, FiMail, FiMapPin, FiBriefcase, FiUserPlus, FiUserX, FiCopy, FiCheck } from 'react-icons/fi';
import { employeeService, salaryProfileService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, PAYMENT_STATUS, LEAVE_STATUS, ATTENDANCE_STATUS, formatCurrency, formatDate } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/tables/DataTable.jsx';

const TABS = ['Profile', 'Salary Structure', 'Salary History', 'Attendance', 'Leave', 'Documents', 'Timeline'];

export default function EmployeeProfile() {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('Profile');
  const [revoking, setRevoking] = useState(false);
  const [creds, setCreds] = useState(null);

  const empQ = useQuery({ queryKey: ['employee', id], queryFn: () => employeeService.get(id) });

  const createAccountM = useMutation({
    mutationFn: () => employeeService.createAccount(id),
    onSuccess: (res) => {
      const tmp = res.data?.tempPassword;
      if (tmp) setCreds({ email: res.data.email, tempPassword: tmp });
      else toast.success('Login account created.');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const revokeAccountM = useMutation({
    mutationFn: () => employeeService.revokeAccount(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Login revoked.');
      setRevoking(false);
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
    },
    onError: (err) => { toast.error(errorMessage(err)); setRevoking(false); },
  });

  if (empQ.isLoading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (empQ.isError) return <ErrorState message="Could not load employee." onRetry={empQ.refetch} />;
  const e = empQ.data.data;

  return (
    <div>
      <PageHeader
        title="Employee Profile"
        breadcrumbs={[{ label: 'Employees', to: '/employees' }, { label: `${e.first_name} ${e.last_name || ''}` }]}
        actions={can('employee:update') && (
          <div className="flex gap-2">
            {e.user_id ? (
              <button className="btn-secondary" onClick={() => setRevoking(true)}><FiUserX /> Revoke Login</button>
            ) : (
              <button className="btn-secondary" onClick={() => createAccountM.mutate()} disabled={createAccountM.isPending}>
                {createAccountM.isPending ? <Spinner size={16} /> : <FiUserPlus />} Create Login
              </button>
            )}
            <Link to={`/employees/${id}/edit`} className="btn-primary"><FiEdit2 /> Edit</Link>
          </div>
        )}
      />

      <ConfirmDialog
        open={revoking}
        onClose={() => setRevoking(false)}
        onConfirm={() => revokeAccountM.mutate()}
        title="Revoke portal login?"
        message={`This disables ${e.first_name}'s self-service login. Their employee record is kept.`}
        confirmLabel="Revoke"
        loading={revokeAccountM.isPending}
      />

      {creds && <CredentialsModal creds={creds} name={`${e.first_name} ${e.last_name || ''}`} onClose={() => setCreds(null)} />}

      {/* Header card */}
      <div className="card mb-5 p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar src={e.photo_url} name={`${e.first_name} ${e.last_name || ''}`} size={80} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <h2 className="text-xl font-semibold text-slate-800">{e.first_name} {e.last_name}</h2>
              <StatusBadge map={EMPLOYEE_STATUS} value={e.status} />
            </div>
            <p className="text-sm text-slate-500">{e.designation_name || '—'} · {e.department_name || '—'}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-slate-500 sm:justify-start">
              <span className="flex items-center gap-1"><FiBriefcase size={14} /> {e.employee_code}</span>
              {e.phone && <span className="flex items-center gap-1"><FiPhone size={14} /> {e.phone}</span>}
              {e.email && <span className="flex items-center gap-1"><FiMail size={14} /> {e.email}</span>}
              {e.city && <span className="flex items-center gap-1"><FiMapPin size={14} /> {e.city}</span>}
            </div>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xs text-slate-400">Monthly Salary</p>
            <p className="text-xl font-semibold text-brand-700">{formatCurrency(e.salary)}</p>
            <p className="text-xs text-slate-400">{EMPLOYMENT_TYPES[e.employment_type]}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.filter((t) => t !== 'Salary Structure' || can('salaryprofile:read')).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card p-1">
        {tab === 'Profile' && <ProfileTab e={e} />}
        {tab === 'Salary Structure' && <SalaryStructureTab id={id} employee={e} canEdit={can('salaryprofile:write')} canSettlePf={can('payroll:write')} />}
        {tab === 'Salary History' && <SalaryTab id={id} />}
        {tab === 'Attendance' && <AttendanceTab id={id} />}
        {tab === 'Leave' && <LeaveTab id={id} />}
        {tab === 'Documents' && <DocumentsTab id={id} />}
        {tab === 'Timeline' && <TimelineTab id={id} />}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value || '—'}</p>
    </div>
  );
}

function ProfileTab({ e }) {
  return (
    <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Full Name" value={`${e.first_name} ${e.middle_name || ''} ${e.last_name || ''}`.trim()} />
      <Field label="Gender" value={e.gender} />
      <Field label="Date of Birth" value={formatDate(e.dob)} />
      <Field label="Blood Group" value={e.blood_group} />
      <Field label="Nationality" value={e.nationality} />
      <Field label="Joining Date" value={formatDate(e.joining_date)} />
      <Field label="Department" value={e.department_name} />
      <Field label="Designation" value={e.designation_name} />
      <Field label="Manager" value={e.manager_name} />
      <Field label="Work Location" value={e.work_location} />
      <Field label="Phone" value={e.phone} />
      <Field label="Email" value={e.email} />
      <Field label="Emergency Contact" value={e.emergency_name && `${e.emergency_name} (${e.emergency_phone || '—'})`} />
      <Field label="Address" value={[e.current_address, e.city, e.state, e.country].filter(Boolean).join(', ')} />
      <Field label="Bank" value={e.bank_name} />
      <Field label="Account Number" value={e.account_number} />
      <Field label="IFSC" value={e.ifsc} />
      <Field label="UPI" value={e.upi_id} />
    </div>
  );
}

function SalaryStructureTab({ id, employee, canEdit, canSettlePf }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['salary-profile', id], queryFn: () => salaryProfileService.get(id) });
  const [form, setForm] = useState(null);
  const [pfForm, setPfForm] = useState({ open: false, amount: '', note: '' });

  const p = data?.data;
  // Initialise the form once the profile loads.
  if (p && form === null) {
    setForm({
      base_salary: p.base_salary ?? employee?.salary ?? '',
      house_allowance: p.house_allowance ?? '',
      medical_allowance: p.medical_allowance ?? '',
      travel_allowance: p.travel_allowance ?? '',
      food_allowance: p.food_allowance ?? '',
      overtime_rate: p.overtime_rate ?? '',
      tax_percent: p.tax_percent ?? '',
      pf_percent: p.pf_percent ?? '',
      esi_percent: p.esi_percent ?? '',
      bonus_eligible: p.bonus_eligible ?? true,
      overtime_eligible: p.overtime_eligible ?? true,
      advance_eligible: p.advance_eligible ?? true,
      loan_eligible: p.loan_eligible ?? true,
    });
  }

  const saveM = useMutation({
    mutationFn: () => salaryProfileService.save(id, {
      ...form,
      base_salary: Number(form.base_salary) || 0,
      house_allowance: Number(form.house_allowance) || 0,
      medical_allowance: Number(form.medical_allowance) || 0,
      travel_allowance: Number(form.travel_allowance) || 0,
      food_allowance: Number(form.food_allowance) || 0,
      overtime_rate: Number(form.overtime_rate) || 0,
      tax_percent: Number(form.tax_percent) || 0,
      pf_percent: Number(form.pf_percent) || 0,
      esi_percent: Number(form.esi_percent) || 0,
    }),
    onSuccess: (res) => { toast.success(res.message || 'Saved.'); queryClient.invalidateQueries({ queryKey: ['salary-profile', id] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const withdrawM = useMutation({
    mutationFn: () => salaryProfileService.withdrawPf(id, {
      amount: pfForm.amount === '' ? undefined : Number(pfForm.amount),
      note: pfForm.note,
    }),
    onSuccess: (res) => {
      toast.success(res.message || 'PF settled.');
      setPfForm({ open: false, amount: '', note: '' });
      queryClient.invalidateQueries({ queryKey: ['salary-profile', id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading || !form) return <div className="flex justify-center py-16"><Spinner size={24} /></div>;
  if (isError) return <ErrorState message="Failed to load salary structure." onRetry={refetch} />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));
  const num = (v) => Number(v) || 0;
  const base = num(form.base_salary);
  const allowances = num(form.house_allowance) + num(form.medical_allowance) + num(form.travel_allowance) + num(form.food_allowance);
  const grossMonthly = base + allowances;
  const pf = base * (num(form.pf_percent) / 100);
  const esi = base * (num(form.esi_percent) / 100);
  const tax = base * (num(form.tax_percent) / 100);
  const estNet = grossMonthly - pf - esi - tax;
  const F = (label, k, prefix, suffix) => (
    <NumField label={label} value={form[k]} onChange={set(k)} disabled={!canEdit} prefix={prefix} suffix={suffix} />
  );

  return (
    <div className="p-4">
      {!canEdit && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">You can view this salary structure but not edit it.</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Base + allowances */}
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Earnings</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {F('Base Salary', 'base_salary', '₹')}
            {F('House Allowance', 'house_allowance', '₹')}
            {F('Medical Allowance', 'medical_allowance', '₹')}
            {F('Travel Allowance', 'travel_allowance', '₹')}
            {F('Food Allowance', 'food_allowance', '₹')}
            {F('Overtime Rate / hr', 'overtime_rate', '₹')}
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-700">Statutory Deductions</h3>
          <p className="-mt-2 mb-3 text-[11px] text-slate-400">
            These percentages are deducted from salary in every payroll run.
            {p.companyDefaults && ` Company defaults — PF ${p.companyDefaults.pf_percent}%, ESI ${p.companyDefaults.esi_percent}%, Tax ${p.companyDefaults.tax_percent}% — are pre-filled; change them to override for this employee.`}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {F('PF', 'pf_percent', null, '%')}
            {F('ESI', 'esi_percent', null, '%')}
            {F('Tax (TDS)', 'tax_percent', null, '%')}
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-700">Eligibility</h3>
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {[['bonus_eligible', 'Bonus'], ['overtime_eligible', 'Overtime'], ['advance_eligible', 'Advance'], ['loan_eligible', 'Loan']].map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" disabled={!canEdit} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={!!form[k]} onChange={toggle(k)} />
                {lbl}
              </label>
            ))}
          </div>

          {canEdit && (
            <div className="mt-6">
              <button className="btn-primary" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
                {saveM.isPending && <Spinner size={16} className="text-white" />} Save Salary Structure
              </button>
            </div>
          )}
        </div>

        {/* Live summary */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Monthly Summary</h3>
          <div className="space-y-2 text-sm">
            <Row label="Base Salary" value={formatCurrency(base)} />
            <Row label="+ Allowances" value={formatCurrency(allowances)} tone="text-emerald-600" />
            <div className="my-1 border-t border-slate-200" />
            <Row label="Gross" value={formatCurrency(grossMonthly)} bold />
            <Row label={`− PF (${num(form.pf_percent)}%)`} value={formatCurrency(pf)} tone="text-red-600" />
            <Row label={`− ESI (${num(form.esi_percent)}%)`} value={formatCurrency(esi)} tone="text-red-600" />
            {num(form.tax_percent) > 0 && <Row label={`− Tax (${num(form.tax_percent)}%)`} value={formatCurrency(tax)} tone="text-red-600" />}
            <div className="my-1 border-t border-slate-200" />
            <Row label="Est. Net (before bonus/EMI)" value={formatCurrency(estNet)} bold tone="text-brand-700" />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Bonus, deductions, loan EMI and advance recovery are applied per month when payroll is generated.</p>
        </div>
      </div>

      {/* Provident Fund corpus — accumulated for retirement / final settlement.
          This endpoint (salaryprofile:read) is not accessible to the employee. */}
      {p.pfCorpus && (
        <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Provident Fund (PF) Corpus</h3>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Employee PF accumulated from paid salaries, held for retirement / final settlement.
                Visible to HR, Accountant &amp; Admin only — not to the employee.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Available</p>
              <p className="whitespace-nowrap text-2xl font-bold text-indigo-700">{formatCurrency(p.pfCorpus.available)}</p>
              <p className="text-[11px] text-slate-400">
                {formatCurrency(p.pfCorpus.collected)} collected · {formatCurrency(p.pfCorpus.withdrawn)} settled
              </p>
            </div>
          </div>

          {canSettlePf && p.pfCorpus.available > 0 && (
            pfForm.open ? (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">Settle / withdraw PF (leave amount blank to settle the full corpus)</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input type="number" step="0.01" max={p.pfCorpus.available} className="input" placeholder={`Full: ${formatCurrency(p.pfCorpus.available)}`} value={pfForm.amount} onChange={(e) => setPfForm((f) => ({ ...f, amount: e.target.value }))} />
                  <input className="input sm:col-span-2" placeholder="Note (e.g. Retirement settlement)" value={pfForm.note} onChange={(e) => setPfForm((f) => ({ ...f, note: e.target.value }))} />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setPfForm({ open: false, amount: '', note: '' })}>Cancel</button>
                  <button className="btn-primary" onClick={() => withdrawM.mutate()} disabled={withdrawM.isPending}>
                    {withdrawM.isPending && <Spinner size={14} className="text-white" />} Confirm settlement
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary mt-3" onClick={() => setPfForm({ open: true, amount: '', note: '' })}>Settle / Withdraw PF</button>
            )
          )}

          {p.pfCorpus.contributions?.length > 0 ? (
            <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Month</th>
                    <th className="px-3 py-1.5 text-right font-medium">PF Contribution</th>
                    <th className="px-3 py-1.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {p.pfCorpus.contributions.map((c) => (
                    <tr key={c.period}>
                      <td className="px-3 py-1.5 text-slate-600">{c.period}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-indigo-700">{formatCurrency(c.pf)}</td>
                      <td className="px-3 py-1.5 text-right capitalize text-slate-400">{c.payment_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No PF collected yet — the corpus grows as this employee’s payrolls are paid.</p>
          )}

          {p.pfCorpus.withdrawals?.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Settlements / Withdrawals</p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
                {p.pfCorpus.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-3 py-1.5">
                    <div>
                      <span className="text-slate-600">{w.note || 'PF settlement'}</span>
                      <span className="ml-2 text-[11px] text-slate-400">{w.settled_by_name ? `by ${w.settled_by_name} · ` : ''}{formatDate(w.settled_at)}</span>
                    </div>
                    <span className="whitespace-nowrap font-medium text-amber-700">−{formatCurrency(w.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shown once right after a login is created. The temporary password is only
 * returned by the server this one time (it is stored hashed), so HR must copy
 * it here to share with the employee. Stays open until dismissed.
 */
function CredentialsModal({ creds, name, onClose }) {
  const [copied, setCopied] = useState('');
  const copy = (what, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      toast.success('Copied to clipboard.');
      setTimeout(() => setCopied(''), 2000);
    }).catch(() => toast.error('Copy failed — select and copy manually.'));
  };
  const both = `Email: ${creds.email}\nTemporary password: ${creds.tempPassword}`;
  const Line = ({ label, value, keyName }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-mono text-sm text-slate-800">{value}</p>
      </div>
      <button className="btn-secondary shrink-0 px-2 py-1 text-xs" onClick={() => copy(keyName, value)}>
        {copied === keyName ? <FiCheck className="text-emerald-600" /> : <FiCopy />} Copy
      </button>
    </div>
  );
  return (
    <Modal open title="Login created" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Portal login for <span className="font-medium text-slate-800">{name}</span> is ready. Copy these credentials now and share them with the employee —
          <span className="font-medium text-amber-700"> the temporary password is shown only this once.</span>
        </p>
        <Line label="Email / Username" value={creds.email} keyName="email" />
        <Line label="Temporary password" value={creds.tempPassword} keyName="password" />
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={() => copy('both', both)}>
            {copied === 'both' ? <FiCheck className="text-emerald-600" /> : <FiCopy />} Copy both
          </button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
        <p className="text-[11px] text-slate-400">The employee should change this password after first sign-in.</p>
      </div>
    </Modal>
  );
}

// Module-level so its identity is stable across parent re-renders — otherwise
// the <input> remounts on every keystroke and the field loses focus.
function NumField({ label, value, onChange, disabled, prefix, suffix }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{prefix}</span>}
        <input
          type="number"
          min="0"
          inputMode="decimal"
          disabled={disabled}
          className={`input ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''} disabled:bg-slate-50 disabled:text-slate-500`}
          value={value}
          onChange={onChange}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-slate-500 ${bold ? 'font-semibold text-slate-700' : ''}`}>{label}</span>
      <span className={`${tone || 'text-slate-700'} ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

function SalaryTab({ id }) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['employee', id, 'salary'], queryFn: () => employeeService.salaryHistory(id) });
  return (
    <DataTable
      loading={isLoading}
      error={isError ? 'Failed to load.' : null}
      onRetry={refetch}
      rows={data?.data || []}
      emptyTitle="No salary records"
      columns={[
        { key: 'period', header: 'Period', render: (r) => `${r.month}/${r.year}` },
        { key: 'net_amount', header: 'Net', align: 'right', render: (r) => formatCurrency(r.net_amount ?? r.salary_amount) },
        { key: 'paid_amount', header: 'Paid', align: 'right', render: (r) => formatCurrency(r.paid_amount) },
        { key: 'remaining_amount', header: 'Remaining', align: 'right', render: (r) => formatCurrency(r.remaining_amount) },
        { key: 'payment_status', header: 'Status', render: (r) => <StatusBadge map={PAYMENT_STATUS} value={r.payment_status} /> },
      ]}
    />
  );
}

function AttendanceTab({ id }) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['employee', id, 'attendance'], queryFn: () => employeeService.attendance(id, {}) });
  return (
    <>
      {data?.meta && <p className="px-5 pt-4 text-sm text-slate-500">Attendance this month: <span className="font-semibold text-slate-700">{data.meta.percentage}%</span></p>}
      <DataTable
        loading={isLoading}
        error={isError ? 'Failed to load.' : null}
        onRetry={refetch}
        rows={data?.data || []}
        emptyTitle="No attendance records"
        columns={[
          { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
          { key: 'check_in', header: 'In', render: (r) => r.check_in || '—' },
          { key: 'check_out', header: 'Out', render: (r) => r.check_out || '—' },
          { key: 'working_hours', header: 'Hours', render: (r) => r.working_hours ?? '—' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge map={ATTENDANCE_STATUS} value={r.status} /> },
        ]}
      />
    </>
  );
}

function LeaveTab({ id }) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['employee', id, 'leaves'], queryFn: () => employeeService.leaves(id) });
  return (
    <DataTable
      loading={isLoading}
      error={isError ? 'Failed to load.' : null}
      onRetry={refetch}
      rows={data?.data || []}
      emptyTitle="No leave records"
      columns={[
        { key: 'leave_type', header: 'Type', render: (r) => r.leave_type || '—' },
        { key: 'start_date', header: 'From', render: (r) => formatDate(r.start_date) },
        { key: 'end_date', header: 'To', render: (r) => formatDate(r.end_date) },
        { key: 'total_days', header: 'Days', render: (r) => r.total_days },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge map={LEAVE_STATUS} value={r.status} /> },
      ]}
    />
  );
}

function DocumentsTab({ id }) {
  const { data, isLoading } = useQuery({ queryKey: ['employee', id, 'documents'], queryFn: () => employeeService.documents(id) });
  const docs = data?.data || [];
  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={24} /></div>;
  if (!docs.length) return <EmptyState title="No documents" message="Uploaded documents will appear here." />;
  return (
    <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((d) => (
        <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
          <p className="truncate text-sm font-medium text-slate-700">{d.document_name}</p>
          <p className="text-xs text-slate-400">{d.document_type || 'Document'} · {formatDate(d.uploaded_at)}</p>
        </a>
      ))}
    </div>
  );
}

function TimelineTab({ id }) {
  const { data, isLoading } = useQuery({ queryKey: ['employee', id, 'timeline'], queryFn: () => employeeService.timeline(id) });
  const items = data?.data || [];
  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={24} /></div>;
  if (!items.length) return <EmptyState title="No activity yet" />;
  return (
    <ol className="relative ml-3 space-y-4 border-l border-slate-200 p-5 pl-6">
      {items.map((t) => (
        <li key={t.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
          <p className="text-sm text-slate-700">{t.description || t.action}</p>
          <p className="text-xs text-slate-400">{formatDate(t.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
