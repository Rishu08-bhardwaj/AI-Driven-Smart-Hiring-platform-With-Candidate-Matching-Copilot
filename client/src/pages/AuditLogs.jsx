import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { auditService } from '../services/index.js';
import { ROLES } from '../constants/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import DataTable from '../components/tables/DataTable.jsx';
import Pagination from '../components/common/Pagination.jsx';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, search, action],
    queryFn: () => auditService.list({ page, limit: 25, search, action }),
    placeholderData: keepPreviousData,
  });
  const { data: actionsData } = useQuery({ queryKey: ['audit-actions'], queryFn: () => auditService.actions() });

  const columns = [
    { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'user', header: 'User', render: (r) => (r.user_name ? <span>{r.user_name} <span className="text-xs text-slate-400">({ROLES[r.user_role] || r.user_role})</span></span> : '—') },
    { key: 'action', header: 'Action', render: (r) => <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{r.action}</span> },
    { key: 'entity', header: 'Entity', render: (r) => (r.entity ? `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ''}` : '—') },
    { key: 'description', header: 'Details', render: (r) => <span className="text-slate-600">{r.description || '—'}</span> },
    { key: 'ip_address', header: 'IP', render: (r) => <span className="text-xs text-slate-400">{r.ip_address || '—'}</span> },
  ];

  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Every change made in the system, with who and when."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Audit Logs' }]}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <input
          className="input max-w-xs"
          placeholder="Search description / user…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input max-w-xs" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          {(actionsData?.data || []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No audit entries" />
        {meta && meta.totalPages > 1 && (
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
        )}
      </div>
    </div>
  );
}
