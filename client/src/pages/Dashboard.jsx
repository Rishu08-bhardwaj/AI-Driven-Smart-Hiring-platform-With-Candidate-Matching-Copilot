import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  FiUsers, FiUserCheck, FiUserX, FiCalendar, FiDollarSign, FiClock,
  FiTrendingUp, FiAlertCircle, FiBriefcase, FiPlus,
} from 'react-icons/fi';
import { dashboardService } from '../services/index.js';
import { formatCurrency, formatDate } from '../constants/index.js';
import { PALETTE, baseOptions } from '../components/dashboard/chartSetup.js';
import StatCard from '../components/dashboard/StatCard.jsx';
import ChartCard from '../components/dashboard/ChartCard.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Spinner from '../components/common/Spinner.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import Avatar from '../components/common/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (period) => {
  const [y, m] = period.split('-');
  return `${MONTHS[Number(m) - 1]} ${String(y).slice(2)}`;
};

export default function Dashboard() {
  const { can } = useAuth();
  const statsQ = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: dashboardService.stats });
  const chartsQ = useQuery({ queryKey: ['dashboard', 'charts'], queryFn: () => dashboardService.charts(6) });
  const widgetsQ = useQuery({ queryKey: ['dashboard', 'widgets'], queryFn: dashboardService.widgets });

  if (statsQ.isError) return <ErrorState message="Could not load dashboard." onRetry={statsQ.refetch} />;

  const s = statsQ.data?.data;
  const c = chartsQ.data?.data;
  const w = widgetsQ.data?.data;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Business & workforce overview"
        actions={
          can('employee:create') && (
            <Link to="/employees/new" className="btn-primary">
              <FiPlus /> Add Employee
            </Link>
          )
        }
      />

      {/* Stat cards */}
      {statsQ.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total Employees" value={s.employees.total} icon={FiUsers} tone="blue" />
            <StatCard label="Active" value={s.employees.active} icon={FiUserCheck} tone="green" />
            <StatCard label="Inactive" value={s.employees.inactive} icon={FiUserX} tone="slate" />
            <StatCard label="On Leave" value={s.employees.onLeave} icon={FiCalendar} tone="amber" />
            <StatCard label="New This Month" value={s.employees.newThisMonth} icon={FiTrendingUp} tone="violet" />
            <StatCard label="Joined Today" value={s.employees.joinedToday} icon={FiUserCheck} tone="green" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Monthly Payroll" value={formatCurrency(s.salary.totalMonthlyPayroll)} icon={FiDollarSign} tone="blue" />
            <StatCard label="Paid This Month" value={formatCurrency(s.salary.paidThisMonth)} icon={FiDollarSign} tone="green" />
            <StatCard label="Outstanding" value={formatCurrency(s.salary.totalOutstanding)} icon={FiAlertCircle} tone="red" />
            <StatCard label="Present Today" value={s.attendance.present} icon={FiClock} tone="green" hint={`${s.attendance.percentage}% attendance`} />
            <StatCard label="Departments" value={s.company.departments} icon={FiBriefcase} tone="violet" />
            <StatCard label="Pending Leaves" value={s.company.pendingLeaves} icon={FiCalendar} tone="amber" />
          </div>
        </>
      )}

      {/* Charts */}
      {chartsQ.isLoading ? (
        <div className="mt-6 flex justify-center py-12"><Spinner size={28} /></div>
      ) : c ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Monthly Salary Expense">
            <Bar
              options={baseOptions}
              data={{
                labels: c.salaryExpense.map((r) => monthLabel(r.period)),
                datasets: [{ label: 'Payroll', data: c.salaryExpense.map((r) => Number(r.amount)), backgroundColor: PALETTE[0], borderRadius: 6 }],
              }}
            />
          </ChartCard>
          <ChartCard title="Employee Growth">
            <Line
              options={baseOptions}
              data={{
                labels: c.employeeGrowth.map((r) => monthLabel(r.period)),
                datasets: [{ label: 'Joined', data: c.employeeGrowth.map((r) => Number(r.count)), borderColor: PALETTE[1], backgroundColor: 'rgba(16,185,129,0.15)', fill: true, tension: 0.35 }],
              }}
            />
          </ChartCard>
          <ChartCard title="Salary Status (this month)">
            <Pie
              options={baseOptions}
              data={{
                labels: c.salaryStatus.length ? c.salaryStatus.map((r) => r.payment_status) : ['No data'],
                datasets: [{ data: c.salaryStatus.length ? c.salaryStatus.map((r) => Number(r.count)) : [1], backgroundColor: PALETTE }],
              }}
            />
          </ChartCard>
          <ChartCard title="Department Distribution">
            <Bar
              options={{ ...baseOptions, indexAxis: 'y' }}
              data={{
                labels: c.departmentDistribution.map((r) => r.name),
                datasets: [{ label: 'Employees', data: c.departmentDistribution.map((r) => Number(r.count)), backgroundColor: PALETTE[4], borderRadius: 6 }],
              }}
            />
          </ChartCard>
        </div>
      ) : null}

      {/* Widgets */}
      {w && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WidgetCard title="Recent Employees">
            {w.recentEmployees.length === 0 ? <Empty /> : w.recentEmployees.map((e) => (
              <Link key={e.id} to={`/employees/${e.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                <Avatar src={e.photo_url} name={`${e.first_name} ${e.last_name || ''}`} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{e.first_name} {e.last_name}</p>
                  <p className="truncate text-xs text-slate-400">{e.department_name || '—'} · {e.employee_code}</p>
                </div>
                <span className="text-xs text-slate-400">{formatDate(e.joining_date)}</span>
              </Link>
            ))}
          </WidgetCard>

          <WidgetCard title="Pending Salary Alerts">
            {w.pendingSalaryAlerts.length === 0 ? <Empty /> : w.pendingSalaryAlerts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-slate-400">{p.month}/{p.year} · {p.employee_code}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{formatCurrency(p.remaining_amount)}</span>
              </div>
            ))}
          </WidgetCard>

          <WidgetCard title="Upcoming Birthdays">
            {w.upcomingBirthdays.length === 0 ? <Empty /> : w.upcomingBirthdays.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <Avatar src={e.photo_url} name={`${e.first_name} ${e.last_name || ''}`} size={32} />
                <p className="flex-1 text-sm text-slate-700">{e.first_name} {e.last_name}</p>
                <span className="text-xs text-slate-400">{formatDate(e.dob)}</span>
              </div>
            ))}
          </WidgetCard>

          <WidgetCard title="Recent Activity">
            {w.recentActivity.length === 0 ? <Empty /> : w.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg px-2 py-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-600">{a.description || a.action}</p>
                  <p className="text-xs text-slate-400">{a.user_name || 'System'} · {formatDate(a.created_at)}</p>
                </div>
              </div>
            ))}
          </WidgetCard>
        </div>
      )}
    </div>
  );
}

function WidgetCard({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function Empty() {
  return <p className="px-2 py-6 text-center text-sm text-slate-400">Nothing to show yet</p>;
}
