import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiSlash, FiTag, FiCalendar } from 'react-icons/fi';
import { leaveService, leaveTypeService, departmentService, employeeService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { LEAVE_STATUS, formatDate } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Modal from '../../components/common/Modal.jsx';
import Spinner from '../../components/common/Spinner.jsx';

export default function Leaves() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', leave_type_id: '', department_id: '' });
  const [applyOpen, setApplyOpen] = useState(false);
  const [decision, setDecision] = useState(null); // { leave, action }

  const params = { page, limit: 15, ...clean(filters) };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaves', params], queryFn: () => leaveService.list(params), placeholderData: keepPreviousData,
  });
  const typesQ = useQuery({ queryKey: ['leave-types'], queryFn: () => leaveTypeService.list({ status: 'active' }) });
  const deptQ = useQuery({ queryKey: ['departments', 'active'], queryFn: () => departmentService.list({ status: 'active' }) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leaves'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const cancelMutation = useMutation({
    mutationFn: (id) => leaveService.cancel(id, 'Cancelled by admin'),
    onSuccess: (res) => { toast.success(res.message || 'Cancelled.'); invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rows = data?.data || [];
  const meta = data?.meta || {};

  const columns = [
    {
      key: 'employee', header: 'Employee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.photo_url} name={`${r.first_name} ${r.last_name || ''}`} size={34} />
          <div>
            <p className="font-medium text-slate-700">{r.first_name} {r.last_name}</p>
            <p className="text-xs text-slate-400">{r.employee_code}</p>
          </div>
        </div>
      ),
    },
    { key: 'leave_type_name', header: 'Type', render: (r) => (
      <span className="flex items-center gap-2">
        {r.leave_type_name || '—'}
        {r.source === 'attendance' && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title="Recorded directly in attendance — not a formal leave application">
            from attendance
          </span>
        )}
      </span>
    ) },
    { key: 'dates', header: 'Dates', render: (r) => `${formatDate(r.start_date)} → ${formatDate(r.end_date)}` },
    { key: 'total_days', header: 'Days', align: 'right', render: (r) => Number(r.total_days) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge map={LEAVE_STATUS} value={r.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {/* Attendance-recorded leaves are read-only here — manage them in Attendance. */}
          {r.source === 'attendance' ? (
            <span className="text-[11px] text-slate-300">read-only</span>
          ) : (
            <>
              {r.status === 'pending' && can('leave:approve') && (
                <>
                  <button onClick={() => setDecision({ leave: r, action: 'approved' })} className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50" title="Approve"><FiCheck size={16} /></button>
                  <button onClick={() => setDecision({ leave: r, action: 'rejected' })} className="rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Reject"><FiX size={16} /></button>
                </>
              )}
              {['pending', 'approved'].includes(r.status) && can('leave:write') && (
                <button onClick={() => cancelMutation.mutate(r.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100" title="Cancel"><FiSlash size={16} /></button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle="Requests, approvals & balances"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Leave' }]}
        actions={
          <div className="flex gap-2">
            <Link to="/holidays" className="btn-secondary"><FiCalendar /> Holidays</Link>
            <Link to="/leave-types" className="btn-secondary"><FiTag /> Types</Link>
            {can('leave:write') && <button className="btn-primary" onClick={() => setApplyOpen(true)}><FiPlus /> Apply Leave</button>}
          </div>
        }
      />

      <div className="card">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <select className="input" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(LEAVE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select className="input" value={filters.leave_type_id} onChange={(e) => { setFilters((f) => ({ ...f, leave_type_id: e.target.value })); setPage(1); }}>
            <option value="">All types</option>
            {(typesQ.data?.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="input" value={filters.department_id} onChange={(e) => { setFilters((f) => ({ ...f, department_id: e.target.value })); setPage(1); }}>
            <option value="">All departments</option>
            {(deptQ.data?.data || []).map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
        </div>

        <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.source || 'leave'}-${r.id}`} loading={isLoading} error={isError ? 'Failed to load leave requests.' : null} onRetry={refetch} emptyTitle="No leave requests" />
        <div className="border-t border-slate-100">
          <Pagination page={meta.page || 1} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
        </div>
      </div>

      {applyOpen && <ApplyModal types={typesQ.data?.data || []} onClose={() => setApplyOpen(false)} onDone={invalidate} />}
      {decision && <DecisionModal decision={decision} onClose={() => setDecision(null)} onDone={invalidate} />}
    </div>
  );
}

function ApplyModal({ types, onClose, onDone }) {
  const empQ = useQuery({ queryKey: ['employees', 'picker'], queryFn: () => employeeService.list({ limit: 100, status: 'active' }) });
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', half_day: false, reason: '' });

  const mutation = useMutation({
    mutationFn: () => leaveService.apply(clean(form)),
    onSuccess: (res) => { toast.success(res.message || 'Submitted.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const valid = form.employee_id && form.leave_type_id && form.start_date && form.end_date;

  return (
    <Modal open onClose={onClose} title="Apply for Leave"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Submit
        </button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Employee</label>
          <select className="input" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select employee…</option>
            {(empQ.data?.data || []).map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Leave Type</label>
          <select className="input" value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}>
            <option value="">Select type…</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_paid ? '' : ' (unpaid)'}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} /></div>
          <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="rounded border-slate-300 text-brand-600" checked={form.half_day} onChange={(e) => setForm((f) => ({ ...f, half_day: e.target.checked }))} />
          Half day
        </label>
        <div><label className="label">Reason</label><textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

function DecisionModal({ decision, onClose, onDone }) {
  const [remarks, setRemarks] = useState('');
  const { leave, action } = decision;
  const mutation = useMutation({
    mutationFn: () => leaveService.decide(leave.id, { status: action, remarks }),
    onSuccess: (res) => { toast.success(res.message || 'Done.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <Modal open onClose={onClose} size="sm" title={`${action === 'approved' ? 'Approve' : 'Reject'} leave`}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={action === 'approved' ? 'btn-primary' : 'btn-danger'} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} {action === 'approved' ? 'Approve' : 'Reject'}
        </button>
      </>}
    >
      <p className="mb-3 text-sm text-slate-600">
        {action === 'approved' ? 'Approve' : 'Reject'} {leave.leave_type_name} for <strong>{leave.first_name} {leave.last_name}</strong> ({Number(leave.total_days)} day(s))?
      </p>
      <input className="input" placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
    </Modal>
  );
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null && v !== false));
}
