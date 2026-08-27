import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiUsers, FiDollarSign, FiClock, FiCalendar } from 'react-icons/fi';
import { reportService } from '../services/index.js';
import { formatCurrency } from '../constants/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import StatCard from '../components/dashboard/StatCard.jsx';
import DataTable from '../components/tables/DataTable.jsx';
import Spinner from '../components/common/Spinner.jsx';

const now = new Date();

export default function Reports() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const headcountQ = useQuery({ queryKey: ['report', 'headcount'], queryFn: () => reportService.headcount() });
  const payrollQ = useQuery({ queryKey: ['report', 'payroll', month, year], queryFn: () => reportService.payroll({ month, year }) });
  const attendanceQ = useQuery({ queryKey: ['report', 'attendance', month, year], queryFn: () => reportService.attendance({ month, year }) });
  const leaveQ = useQuery({ queryKey: ['report', 'leave', year], queryFn: () => reportService.leave({ year }) });

  const hc = headcountQ.data?.data;
  const pay = payrollQ.data?.data;
  const att = attendanceQ.data?.data;
  const lv = leaveQ.data?.data;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Headcount, payroll, attendance and leave summaries."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Reports' }]}
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

      {/* Headcount */}
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Headcount</h3>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Employees" value={hc?.totals.total ?? '—'} icon={FiUsers} tone="blue" />
        <StatCard label="Active" value={hc?.totals.active ?? '—'} icon={FiUsers} tone="green" />
        <StatCard label="Inactive" value={hc?.totals.inactive ?? '—'} icon={FiUsers} tone="slate" />
        <StatCard label="Departments" value={hc?.byDepartment?.length ?? '—'} icon={FiUsers} tone="violet" />
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <ReportTable title="By Department" loading={headcountQ.isLoading} rows={hc?.byDepartment} cols={[{ key: 'name', header: 'Department' }, { key: 'count', header: 'Count', align: 'right' }]} />
        <ReportTable title="By Employment Type" loading={headcountQ.isLoading} rows={hc?.byType} cols={[{ key: 'name', header: 'Type' }, { key: 'count', header: 'Count', align: 'right' }]} />
      </div>

      {/* Payroll */}
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Payroll — {month}/{year}</h3>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross" value={pay ? formatCurrency(pay.totals.gross) : '—'} icon={FiDollarSign} tone="blue" />
        <StatCard label="Net" value={pay ? formatCurrency(pay.totals.net) : '—'} icon={FiDollarSign} tone="violet" />
        <StatCard label="Paid" value={pay ? formatCurrency(pay.totals.paid) : '—'} icon={FiDollarSign} tone="green" />
        <StatCard label="Pending" value={pay ? formatCurrency(pay.totals.pending) : '—'} icon={FiDollarSign} tone="amber" />
      </div>
      <div className="mb-8">
        <ReportTable
          title="Payroll by Department"
          loading={payrollQ.isLoading}
          rows={pay?.byDepartment}
          cols={[{ key: 'name', header: 'Department' }, { key: 'employees', header: 'Employees', align: 'right' }, { key: 'amount', header: 'Net Amount', align: 'right', render: (r) => formatCurrency(r.amount) }]}
        />
      </div>

      {/* Attendance + Leave */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><FiClock /> Attendance — {month}/{year}</h3>
          <ReportTable loading={attendanceQ.isLoading} rows={att?.byStatus} cols={[{ key: 'name', header: 'Status' }, { key: 'count', header: 'Count', align: 'right' }]} />
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><FiCalendar /> Leave — {year}</h3>
          <ReportTable loading={leaveQ.isLoading} rows={lv?.byType} cols={[{ key: 'name', header: 'Type' }, { key: 'requests', header: 'Requests', align: 'right' }, { key: 'days', header: 'Days', align: 'right' }]} />
        </div>
      </div>
    </div>
  );
}

function ReportTable({ title, rows, cols, loading }) {
  return (
    <div className="card">
      {title && <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">{title}</div>}
      {loading ? (
        <div className="flex justify-center py-10"><Spinner size={22} /></div>
      ) : (
        <DataTable columns={cols} rows={rows || []} emptyTitle="No data" />
      )}
    </div>
  );
}
