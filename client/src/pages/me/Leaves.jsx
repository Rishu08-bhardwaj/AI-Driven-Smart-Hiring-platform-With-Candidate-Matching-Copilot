import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiXCircle } from 'react-icons/fi';
import { meService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatDate, LEAVE_STATUS } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { Input, Textarea, Select, Options } from '../../components/forms/fields.jsx';

const schema = yup.object({
  leave_type_id: yup.string().required('Leave type is required'),
  start_date: yup.string().required('Start date is required'),
  end_date: yup.string().required('End date is required'),
  reason: yup.string().max(500).nullable(),
});

export default function MyLeaves() {
  const queryClient = useQueryClient();
  const [applying, setApplying] = useState(false);
  const [toCancel, setToCancel] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['me', 'leaves'], queryFn: () => meService.leaves() });
  const { data: typesData } = useQuery({ queryKey: ['me', 'leave-types'], queryFn: () => meService.leaveTypes() });
  const { data: balData } = useQuery({ queryKey: ['me', 'leave-balances'], queryFn: () => meService.leaveBalances() });

  const applyMutation = useMutation({
    mutationFn: (values) => meService.applyLeave(values),
    onSuccess: (res) => {
      toast.success(res.message || 'Leave applied.');
      setApplying(false);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => meService.cancelLeave(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Cancelled.');
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => { toast.error(errorMessage(err)); setToCancel(null); },
  });

  const columns = [
    { key: 'leave_type', header: 'Type', render: (l) => <span className="font-medium text-slate-700 capitalize">{l.leave_type || 'Leave'}</span> },
    { key: 'start_date', header: 'From', render: (l) => formatDate(l.start_date) },
    { key: 'end_date', header: 'To', render: (l) => formatDate(l.end_date) },
    { key: 'total_days', header: 'Days', align: 'right', render: (l) => l.total_days },
    { key: 'status', header: 'Status', render: (l) => { const s = LEAVE_STATUS[l.status]; return <StatusBadge tone={s?.tone || 'gray'}>{s?.label || l.status}</StatusBadge>; } },
    {
      key: 'actions', header: '', align: 'right',
      render: (l) => l.status === 'pending' ? (
        <button onClick={() => setToCancel(l)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"><FiXCircle size={14} /> Cancel</button>
      ) : null,
    },
  ];

  const balances = balData?.data || [];

  return (
    <div>
      <PageHeader
        title="My Leave"
        subtitle="Apply for leave and track your requests."
        actions={<button className="btn-primary" onClick={() => setApplying(true)}><FiPlus /> Apply Leave</button>}
      />

      {balances.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {balances.map((b) => (
            <div key={b.id || b.leave_type_id} className="card px-4 py-2 text-sm">
              <span className="text-slate-500">{b.leave_type_name || b.name || 'Leave'}: </span>
              <span className="font-semibold text-slate-700">{Number(b.allocated) - Number(b.used)}</span>
              <span className="text-slate-400"> / {b.allocated}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No leave requests yet" />
      </div>

      <ApplyModal open={applying} onClose={() => setApplying(false)} onSave={(v) => applyMutation.mutate(v)} saving={applyMutation.isPending} types={typesData?.data || []} />

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={() => cancelMutation.mutate(toCancel.id)}
        title="Cancel leave request?"
        message="This will withdraw your pending leave request."
        confirmLabel="Cancel Request"
        loading={cancelMutation.isPending}
      />
    </div>
  );
}

function ApplyModal({ open, onClose, onSave, saving, types }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(schema) });
  useEffect(() => { if (open) reset({ leave_type_id: '', start_date: '', end_date: '', reason: '' }); }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for Leave"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" form="apply-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Submit</button>
        </>
      }
    >
      <form id="apply-form" onSubmit={handleSubmit(onSave)} className="space-y-4">
        <Select label="Leave Type" required error={errors.leave_type_id} {...register('leave_type_id')}>
          <Options map={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="Select leave type…" />
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" required error={errors.start_date} {...register('start_date')} />
          <Input label="End Date" type="date" required error={errors.end_date} {...register('end_date')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('half_day')} />
          Half day (single day only)
        </label>
        <Textarea label="Reason" error={errors.reason} {...register('reason')} />
      </form>
    </Modal>
  );
}
