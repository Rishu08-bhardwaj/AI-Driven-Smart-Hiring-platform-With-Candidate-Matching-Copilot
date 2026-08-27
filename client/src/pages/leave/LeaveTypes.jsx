import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { leaveTypeService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { Input } from '../../components/forms/fields.jsx';

export default function LeaveTypes() {
  const { can } = useAuth();
  const canWrite = can('leavetype:write');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['leave-types', 'all'], queryFn: () => leaveTypeService.list() });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?.id ? leaveTypeService.update(editing.id, values) : leaveTypeService.create(values)),
    onSuccess: (res) => { toast.success(res.message || 'Saved.'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['leave-types'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const delMutation = useMutation({
    mutationFn: (id) => leaveTypeService.remove(id),
    onSuccess: (res) => { toast.success(res.message || 'Deleted.'); setToDelete(null); queryClient.invalidateQueries({ queryKey: ['leave-types'] }); },
    onError: (err) => { toast.error(errorMessage(err)); setToDelete(null); },
  });

  const columns = [
    { key: 'name', header: 'Leave Type', render: (t) => <span className="font-medium text-slate-700">{t.name}</span> },
    { key: 'code', header: 'Code' },
    { key: 'default_days', header: 'Default Days', align: 'right', render: (t) => Number(t.default_days) },
    { key: 'is_paid', header: 'Paid', render: (t) => <StatusBadge tone={t.is_paid ? 'green' : 'gray'}>{t.is_paid ? 'Paid' : 'Unpaid'}</StatusBadge> },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge tone={t.status === 'active' ? 'green' : 'gray'}>{t.status}</StatusBadge> },
    ...(canWrite ? [{
      key: 'actions', header: '', align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><FiEdit2 size={16} /></button>
          <button onClick={() => setToDelete(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={16} /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Leave Types"
        breadcrumbs={[{ label: 'Leave', to: '/leaves' }, { label: 'Types' }]}
        actions={canWrite && <button className="btn-primary" onClick={() => setEditing({})}><FiPlus /> Add Type</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No leave types yet" />
      </div>

      <TypeModal editing={editing} onClose={() => setEditing(null)} onSave={(v) => saveMutation.mutate(v)} saving={saveMutation.isPending} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => delMutation.mutate(toDelete.id)} title="Delete leave type?" message={`Delete "${toDelete?.name}"?`} confirmLabel="Delete" loading={delMutation.isPending} />
    </div>
  );
}

function TypeModal({ editing, onClose, onSave, saving }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const open = editing !== null;
  useEffect(() => {
    if (open) reset({ name: editing.name || '', code: editing.code || '', default_days: editing.default_days ?? 0, is_paid: editing.is_paid ?? true });
  }, [open, editing, reset]);

  return (
    <Modal open={open} onClose={onClose} title={editing?.id ? 'Edit Leave Type' : 'Add Leave Type'}
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" form="lt-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Save</button>
      </>}
    >
      <form id="lt-form" onSubmit={handleSubmit((v) => onSave({ ...v, is_paid: !!v.is_paid }))} className="space-y-4">
        <Input label="Name" required error={errors.name} {...register('name', { required: 'Name is required' })} />
        <Input label="Code" required error={errors.code} {...register('code', { required: 'Code is required' })} />
        <Input type="number" step="0.5" label="Default Days / Year" {...register('default_days')} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="rounded border-slate-300 text-brand-600" {...register('is_paid')} /> Paid leave
        </label>
      </form>
    </Modal>
  );
}
