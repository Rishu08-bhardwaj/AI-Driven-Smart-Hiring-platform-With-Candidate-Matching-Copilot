import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiCheckSquare, FiUsers, FiEdit2, FiClock } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { attendanceService, departmentService, employeeService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { ATTENDANCE_STATUS, formatDate } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Modal from '../../components/common/Modal.jsx';
import Spinner from '../../components/common/Spinner.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const fmtMin = (m) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—');

export default function Attendance() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = can('attendance:write');

  const [date, setDate] = useState(today());
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ department_id: '', status: '' });
  const [markOpen, setMarkOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [correcting, setCorrecting] = useState(null);

  const params = { date, page, limit: 15, ...clean(filters) };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceService.list(params),
    placeholderData: keepPreviousData,
  });
  const deptQ = useQuery({ queryKey: ['departments', 'active'], queryFn: () => departmentService.list({ status: 'active' }) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

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
            <p className="text-xs text-slate-400">{r.employee_code} · {r.department_name || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'check_in', header: 'In', render: (r) => r.check_in || '—' },
    { key: 'check_out', header: 'Out', render: (r) => r.check_out || '—' },
    { key: 'working_minutes', header: 'Worked', render: (r) => fmtMin(r.working_minutes) },
    { key: 'late_minutes', header: 'Late', render: (r) => (r.late_minutes ? `${r.late_minutes}m` : '—') },
    { key: 'overtime_minutes', header: 'OT', render: (r) => (r.overtime_minutes ? `${r.overtime_minutes}m` : '—') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge map={ATTENDANCE_STATUS} value={r.status} /> },
    ...(canWrite ? [{
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => setCorrecting(r)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Correct"><FiEdit2 size={16} /></button>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Daily attendance & corrections"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance' }]}
        actions={
          <div className="flex gap-2">
            <Link to="/shifts" className="btn-secondary"><FiClock /> Shifts</Link>
            {canWrite && <button className="btn-secondary" onClick={() => setBulkOpen(true)}><FiUsers /> Bulk</button>}
            {canWrite && <button className="btn-primary" onClick={() => setMarkOpen(true)}><FiCheckSquare /> Mark</button>}
          </div>
        }
      />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
            <select className="input" value={filters.department_id} onChange={(e) => { setFilters((f) => ({ ...f, department_id: e.target.value })); setPage(1); }}>
              <option value="">All departments</option>
              {(deptQ.data?.data || []).map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select className="input" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
              <option value="">All statuses</option>
              {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={isError ? 'Failed to load attendance.' : null}
          onRetry={refetch}
          emptyTitle="No attendance for this date"
          emptyMessage={canWrite ? 'Use “Mark” or “Bulk” to record attendance.' : undefined}
        />
        <div className="border-t border-slate-100">
          <Pagination page={meta.page || 1} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
        </div>
      </div>

      {markOpen && <MarkModal date={date} onClose={() => setMarkOpen(false)} onDone={invalidate} />}
      {bulkOpen && <BulkModal date={date} onClose={() => setBulkOpen(false)} onDone={invalidate} />}
      {correcting && <CorrectModal record={correcting} onClose={() => setCorrecting(null)} onDone={invalidate} />}
    </div>
  );
}

function useEmployees() {
  return useQuery({ queryKey: ['employees', 'picker'], queryFn: () => employeeService.list({ limit: 100, status: 'active' }) });
}

function MarkModal({ date, onClose, onDone }) {
  const empQ = useEmployees();
  const [form, setForm] = useState({ employee_id: '', status: 'present', check_in: '', check_out: '', remarks: '' });
  const mutation = useMutation({
    mutationFn: () => attendanceService.mark({ ...clean(form), date }),
    onSuccess: (res) => { toast.success(res.message || 'Saved.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal open onClose={onClose} title={`Mark Attendance · ${formatDate(date)}`}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.employee_id}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Save
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
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Check In</label><input type="time" className="input" value={form.check_in} onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))} /></div>
          <div><label className="label">Check Out</label><input type="time" className="input" value={form.check_out} onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))} /></div>
        </div>
        <div><label className="label">Remarks</label><input className="input" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
        <p className="text-xs text-slate-400">Late, overtime and working hours are calculated automatically from the employee’s shift.</p>
      </div>
    </Modal>
  );
}

function BulkModal({ date, onClose, onDone }) {
  const empQ = useEmployees();
  const [status, setStatus] = useState('present');
  const [selected, setSelected] = useState([]);
  const employees = empQ.data?.data || [];

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = employees.length > 0 && selected.length === employees.length;

  const mutation = useMutation({
    mutationFn: () => attendanceService.bulk({ date, status, employee_ids: selected }),
    onSuccess: (res) => { toast.success(res.message || 'Saved.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal open onClose={onClose} title={`Bulk Attendance · ${formatDate(date)}`} size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !selected.length}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Mark {selected.length || ''}
        </button>
      </>}
    >
      <div className="mb-3 flex items-center gap-3">
        <label className="label mb-0">Status</label>
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button className="btn-ghost ml-auto text-sm" onClick={() => setSelected(allSelected ? [] : employees.map((e) => e.id))}>
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {empQ.isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : employees.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
            <input type="checkbox" className="rounded border-slate-300 text-brand-600" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
            <Avatar src={e.photo_url} name={`${e.first_name} ${e.last_name || ''}`} size={28} />
            <span className="text-sm text-slate-700">{e.first_name} {e.last_name}</span>
            <span className="ml-auto text-xs text-slate-400">{e.employee_code}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function CorrectModal({ record, onClose, onDone }) {
  const [form, setForm] = useState({
    status: record.status, check_in: record.check_in || '', check_out: record.check_out || '', reason: '',
  });
  const mutation = useMutation({
    mutationFn: () => attendanceService.correct(record.id, clean(form)),
    onSuccess: (res) => { toast.success(res.message || 'Corrected.'); onDone(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal open onClose={onClose} title={`Correct · ${record.first_name} ${record.last_name || ''}`}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.reason.trim()}>
          {mutation.isPending && <Spinner size={16} className="text-white" />} Save correction
        </button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Check In</label><input type="time" className="input" value={form.check_in} onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))} /></div>
          <div><label className="label">Check Out</label><input type="time" className="input" value={form.check_out} onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))} /></div>
        </div>
        <div>
          <label className="label">Reason <span className="text-red-500">*</span></label>
          <input className="input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Why is this correction needed?" />
        </div>
      </div>
    </Modal>
  );
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}
