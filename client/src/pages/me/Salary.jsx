import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiDownload } from 'react-icons/fi';
import { meService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatCurrency, PAYMENT_STATUS } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MySalary() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['me', 'salary'], queryFn: () => meService.salary() });

  const openSlip = async (id) => {
    try { await meService.openSlip(id); } catch (err) { toast.error(errorMessage(err, 'Could not open slip.')); }
  };

  const columns = [
    { key: 'period', header: 'Period', render: (r) => `${MONTHS[r.month]} ${r.year}` },
    { key: 'salary_amount', header: 'Actual Salary', align: 'right', render: (r) => formatCurrency(r.salary_amount) },
    { key: 'emi', header: 'EMI', align: 'right', render: (r) => (Number(r.loan_recovery) > 0 ? <span className="text-amber-600">−{formatCurrency(r.loan_recovery)}</span> : '—') },
    { key: 'bonus_deduction', header: 'Bonus / Deduction', align: 'right', render: (r) => {
      const net = Number(r.bonus_total || 0) - Number(r.other_deductions || 0);
      if (net === 0) return '—';
      return <span className={net > 0 ? 'text-emerald-600' : 'text-red-600'}>{net > 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}</span>;
    } },
    { key: 'net_amount', header: 'Net (Take-home)', align: 'right', render: (r) => <span className="font-medium text-slate-700">{formatCurrency(r.net_amount)}</span> },
    { key: 'paid_amount', header: 'Paid', align: 'right', render: (r) => formatCurrency(r.paid_amount) },
    { key: 'remaining_amount', header: 'Pending', align: 'right', render: (r) => formatCurrency(r.remaining_amount) },
    { key: 'payment_status', header: 'Status', render: (r) => { const s = PAYMENT_STATUS[r.payment_status]; return <StatusBadge tone={s?.tone || 'gray'}>{s?.label || r.payment_status}</StatusBadge>; } },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => <button onClick={() => openSlip(r.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"><FiDownload size={14} /> Slip</button>,
    },
  ];

  return (
    <div>
      <PageHeader title="My Salary" subtitle="Your payslip history and payment status." />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No salary records yet" />
      </div>
    </div>
  );
}
