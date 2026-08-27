import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Bar, Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import {
  FiPlay, FiDollarSign, FiCreditCard, FiTrendingUp, FiAlertCircle, FiGift,
} from 'react-icons/fi';
import { payrollService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { PAYMENT_STATUS, formatCurrency } from '../../constants/index.js';
import { PALETTE, baseOptions } from '../../components/dashboard/chartSetup.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import ChartCard from '../../components/dashboard/ChartCard.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import PayrollDetail from './PayrollDetail.jsx';
import GenerateModal from './GenerateModal.jsx';

const now = new Date();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse the per-employee active-loan EMI list returned with each payroll row. */
function parseLoanEmis(v) {
  if (!v) return [];
  try {
    const arr = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function Payroll() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [genOpen, setGenOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const dashQ = useQuery({ queryKey: ['payroll', 'dashboard', month, year], queryFn: () => payrollService.dashboard({ month, year }) });
  const listParams = { month, year, page, limit: 15 };
  const listQ = useQuery({ queryKey: ['payroll', 'list', listParams], queryFn: () => payrollService.list(listParams), placeholderData: keepPreviousData });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payroll'] });

  const k = dashQ.data?.data?.kpis;
  const charts = dashQ.data?.data;
  const rows = listQ.data?.data || [];
  const meta = listQ.data?.meta || {};

  const columns = [
    { key: 'employee', header: 'Employee', render: (p) => (
      <div><p className="font-medium text-slate-700">{p.first_name} {p.last_name}</p><p className="text-xs text-slate-400">{p.employee_code}</p></div>
    ) },
    { key: 'salary_amount', header: 'Actual Salary', align: 'right', render: (p) => <span className="font-medium text-slate-700">{formatCurrency(p.salary_amount)}</span> },
    { key: 'allowances', header: 'Allowances', align: 'right', render: (p) => {
      const a = Number(p.gross_amount || 0) - Number(p.salary_amount || 0) - Number(p.bonus_total || 0);
      return a > 0.005 ? <span className="whitespace-nowrap text-emerald-600">+{formatCurrency(a)}</span> : '—';
    } },
    { key: 'bonus', header: 'Bonus', align: 'right', render: (p) => {
      const b = Number(p.bonus_total || 0);
      return b > 0.005 ? <span className="whitespace-nowrap text-emerald-600">+{formatCurrency(b)}</span> : '—';
    } },
    { key: 'emi', header: 'EMI', align: 'right', render: (p) => {
      const total = Number(p.loan_recovery) || 0;
      if (total <= 0) return '—';
      const loans = parseLoanEmis(p.loan_emis);
      return (
        <div className="leading-tight">
          <span className="whitespace-nowrap text-amber-600" title={loans.length >= 2 ? `${loans.length} active loans` : 'Loan EMI'}>−{formatCurrency(total)}</span>
          {loans.length >= 2 && (
            <div className="whitespace-nowrap text-[10px] text-slate-400">{loans.map((l) => formatCurrency(l.emi)).join(' + ')}</div>
          )}
        </div>
      );
    } },
    { key: 'other_deductions', header: 'Deductions', align: 'right', render: (p) => {
      const o = Number(p.pf || 0) + Number(p.esi || 0) + Number(p.tax || 0) + Number(p.advance_recovery || 0)
        + Number(p.absent_deduction || 0) + Number(p.halfday_deduction || 0) + Number(p.late_penalty || 0)
        + Number(p.other_deductions || 0);
      return o > 0.005 ? <span className="whitespace-nowrap text-red-600" title="PF + ESI + Tax + Advance recovery + Absent / Half-day / Late penalties + manual deductions (EMI shown separately). Open the payroll for the itemised breakdown.">−{formatCurrency(o)}</span> : '—';
    } },
    { key: 'net_amount', header: 'NET', align: 'right', render: (p) => <span className="font-semibold text-brand-700" title="Actual + Allowances + Bonus − EMI − Other Ded.">{formatCurrency(p.net_amount)}</span> },
    { key: 'paid_amount', header: 'Paid', align: 'right', render: (p) => formatCurrency(p.paid_amount) },
    { key: 'previous_pending', header: 'Prev. Due', align: 'right', render: (p) => (Number(p.previous_pending) > 0 ? <span className="text-amber-600">{formatCurrency(p.previous_pending)}</span> : '—') },
    { key: 'remaining_amount', header: 'Remaining', align: 'right', render: (p) => <span className={Number(p.remaining_amount) > 0 ? 'text-red-600' : ''}>{formatCurrency(p.remaining_amount)}</span> },
    { key: 'outstanding', header: 'Outstanding', align: 'right', render: (p) => <span className={Number(p.outstanding) > 0 ? 'text-red-600' : 'text-emerald-600'} title="This employee's total unpaid across ALL months (live)">{formatCurrency(p.outstanding)}</span> },
    { key: 'payment_status', header: 'Status', render: (p) => (
      <div className="flex items-center gap-1">
        <StatusBadge map={PAYMENT_STATUS} value={p.payment_status} />
        {Number(p.prior_unpaid) > 0 && (
          <span
            className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
            title={`Earlier months unpaid: ${formatCurrency(p.prior_unpaid)} in arrears`}
          >
            Arrears
          </span>
        )}
        {p.locked ? <span className="text-xs text-slate-400" title="Locked">🔒</span> : null}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Generate, pay and track salaries"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Payroll' }]}
        actions={
          <div className="flex items-center gap-2">
            {can('advance:read') && <Link to="/advances" className="btn-secondary"><FiCreditCard /> Advances</Link>}
            {can('loan:read') && <Link to="/loans" className="btn-secondary"><FiDollarSign /> Loans</Link>}
            {can('payroll:generate') && <button className="btn-primary" onClick={() => setGenOpen(true)}><FiPlay /> Generate</button>}
          </div>
        }
      />

      {/* Period selector */}
      <div className="mb-4 flex items-center gap-2">
        <select className="input w-36" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="input w-28" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}>
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPIs */}
      {dashQ.isLoading ? (
        <div className="flex justify-center py-10"><Spinner size={26} /></div>
      ) : k && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Payroll" value={formatCurrency(k.totalPayroll)} icon={FiDollarSign} tone="blue" />
          <StatCard label="Paid" value={formatCurrency(k.paidSalary)} icon={FiCreditCard} tone="green" />
          <StatCard label="Pending" value={formatCurrency(k.pendingSalary)} icon={FiAlertCircle} tone="amber" />
          <StatCard label="Outstanding" value={formatCurrency(k.totalOutstanding)} icon={FiAlertCircle} tone="red" />
          <StatCard label="Advances" value={formatCurrency(k.totalAdvances)} icon={FiCreditCard} tone="violet" />
          <StatCard label="Bonus" value={formatCurrency(k.totalBonus)} icon={FiGift} tone="green" />
        </div>
      )}

      {/* Charts */}
      {charts && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Payroll Trends (6 mo)">
            <Line options={baseOptions} data={{
              labels: (charts.payrollTrends || []).map((t) => t.period),
              datasets: [
                { label: 'Net', data: charts.payrollTrends.map((t) => Number(t.net)), borderColor: PALETTE[0], backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.35 },
                { label: 'Paid', data: charts.payrollTrends.map((t) => Number(t.paid)), borderColor: PALETTE[1], tension: 0.35 },
              ],
            }} />
          </ChartCard>
          <ChartCard title="Department Payroll">
            <Bar options={{ ...baseOptions, indexAxis: 'y' }} data={{
              labels: (charts.departmentPayroll || []).map((d) => d.name || '—'),
              datasets: [{ label: 'Net', data: charts.departmentPayroll.map((d) => Number(d.amount)), backgroundColor: PALETTE[4], borderRadius: 6 }],
            }} />
          </ChartCard>
        </div>
      )}

      {/* Payroll table */}
      <div className="card mt-4">
        <DataTable
          columns={columns} rows={rows} loading={listQ.isLoading}
          error={listQ.isError ? 'Failed to load payroll.' : null} onRetry={listQ.refetch}
          emptyTitle="No payroll for this period"
          emptyMessage={can('payroll:generate') ? 'Use “Generate” to create payroll for this month.' : undefined}
          onRowClick={(p) => setDetailId(p.id)}
        />
        <div className="border-t border-slate-100">
          <Pagination page={meta.page || 1} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
        </div>
      </div>

      {genOpen && <GenerateModal month={month} year={year} onClose={() => setGenOpen(false)} onDone={invalidate} />}
      {detailId && <PayrollDetail id={detailId} onClose={() => setDetailId(null)} onChange={invalidate} />}
    </div>
  );
}
