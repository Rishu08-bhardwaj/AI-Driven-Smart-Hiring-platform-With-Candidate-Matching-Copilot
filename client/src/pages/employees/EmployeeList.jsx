import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiFilter } from 'react-icons/fi';
import { employeeService, departmentService, designationService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, formatCurrency, formatDate, PAGE_SIZE } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useDebounce from '../../hooks/useDebounce.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';

export default function EmployeeList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', department_id: '', employment_type: '', sort: 'newest' });
  const [showFilters, setShowFilters] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const debouncedSearch = useDebounce(search);

  const params = { page, limit: PAGE_SIZE, search: debouncedSearch, ...clean(filters) };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeeService.list(params),
    placeholderData: keepPreviousData,
  });

  const deptQ = useQuery({ queryKey: ['departments', 'all'], queryFn: () => departmentService.list({ status: 'active' }) });

  const delMutation = useMutation({
    mutationFn: ({ id, archive }) => employeeService.remove(id, archive),
    onSuccess: (res) => {
      toast.success(res.message || 'Employee removed.');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      const msg = errorMessage(err);
      // Offer archive when salary records block deletion.
      if (err?.response?.status === 409 && toDelete) {
        if (window.confirm(`${msg}\n\nArchive this employee instead?`)) {
          delMutation.mutate({ id: toDelete.id, archive: true });
          return;
        }
      }
      toast.error(msg);
      setToDelete(null);
    },
  });

  const rows = data?.data || [];
  const meta = data?.meta || {};

  const columns = [
    {
      key: 'employee', header: 'Employee',
      render: (e) => (
        <div className="flex items-center gap-3">
          <Avatar src={e.photo_url} name={`${e.first_name} ${e.last_name || ''}`} size={36} />
          <div>
            <p className="font-medium text-slate-700">{e.first_name} {e.last_name}</p>
            <p className="text-xs text-slate-400">{e.employee_code}</p>
          </div>
        </div>
      ),
    },
    { key: 'department_name', header: 'Department', render: (e) => e.department_name || '—' },
    { key: 'designation_name', header: 'Designation', render: (e) => e.designation_name || '—' },
    { key: 'joining_date', header: 'Joined', render: (e) => formatDate(e.joining_date) },
    { key: 'salary', header: 'Salary', align: 'right', render: (e) => <span className="font-medium">{formatCurrency(e.salary)}</span> },
    { key: 'employment_type', header: 'Type', render: (e) => <span className="text-xs text-slate-500">{EMPLOYMENT_TYPES[e.employment_type] || e.employment_type}</span> },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge map={EMPLOYEE_STATUS} value={e.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
          <Link to={`/employees/${e.id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View"><FiEye size={16} /></Link>
          {can('employee:update') && <Link to={`/employees/${e.id}/edit`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit"><FiEdit2 size={16} /></Link>}
          {can('employee:delete') && <button onClick={() => setToDelete(e)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete"><FiTrash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Employees' }]}
        actions={can('employee:create') && <Link to="/employees/new" className="btn-primary"><FiPlus /> Add Employee</Link>}
      />

      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, code, email, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="btn-secondary" onClick={() => setShowFilters((v) => !v)}>
            <FiFilter /> Filters
          </button>
          <select className="input sm:w-44" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="salary_high">Highest salary</option>
            <option value="salary_low">Lowest salary</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-3">
            <select className="input" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
              <option value="">All statuses</option>
              {Object.entries(EMPLOYEE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <select className="input" value={filters.department_id} onChange={(e) => { setFilters((f) => ({ ...f, department_id: e.target.value })); setPage(1); }}>
              <option value="">All departments</option>
              {(deptQ.data?.data || []).map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
            <select className="input" value={filters.employment_type} onChange={(e) => { setFilters((f) => ({ ...f, employment_type: e.target.value })); setPage(1); }}>
              <option value="">All types</option>
              {Object.entries(EMPLOYMENT_TYPES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={isError ? 'Failed to load employees.' : null}
          onRetry={refetch}
          emptyTitle="No employees found"
          emptyMessage="Try adjusting your search or filters, or add a new employee."
          onRowClick={(e) => navigate(`/employees/${e.id}`)}
        />
        <div className="border-t border-slate-100">
          <Pagination page={meta.page || 1} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => delMutation.mutate({ id: toDelete.id, archive: false })}
        title="Delete employee?"
        message={`This will remove ${toDelete?.first_name} ${toDelete?.last_name || ''}. Employees with salary records are archived instead.`}
        confirmLabel="Delete"
        loading={delMutation.isPending}
      />
    </div>
  );
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}
