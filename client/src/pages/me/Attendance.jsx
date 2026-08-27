import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { meService } from '../../services/index.js';
import { formatDate, ATTENDANCE_STATUS } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

const now = new Date();

export default function MyAttendance() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['me', 'attendance', month, year],
    queryFn: () => meService.attendance({ month, year }),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => { const s = ATTENDANCE_STATUS[r.status]; return <StatusBadge tone={s?.tone || 'gray'}>{s?.label || r.status}</StatusBadge>; } },
    { key: 'check_in', header: 'Check In', render: (r) => r.check_in || '—' },
    { key: 'check_out', header: 'Check Out', render: (r) => r.check_out || '—' },
    { key: 'working_hours', header: 'Hours', align: 'right', render: (r) => r.working_hours ?? '—' },
    { key: 'remarks', header: 'Remarks', render: (r) => r.remarks || '—' },
  ];

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle={data?.meta ? `${data.meta.percentage}% present this month` : undefined}
        actions={
          <div className="flex gap-2">
            <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>)}
            </select>
            <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        }
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No attendance records" emptyMessage="Nothing marked for this month yet." />
      </div>
    </div>
  );
}
