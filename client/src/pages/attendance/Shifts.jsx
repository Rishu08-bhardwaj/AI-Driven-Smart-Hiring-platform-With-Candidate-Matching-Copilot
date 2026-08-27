import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { shiftService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { Input } from '../../components/forms/fields.jsx';

export default function Shifts() {
  const { can } = useAuth();
  const canWrite = can('shift:write');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['shifts'], queryFn: () => shiftService.list() });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?.id ? shiftService.update(editing.id, values) : shiftService.create(values)),
    onSuccess: (res) => { toast.success(res.message || 'Saved.'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const delMutation = useMutation({
    mutationFn: (id) => shiftService.remove(id),
    onSuccess: (res) => { toast.success(res.message || 'Deleted.'); setToDelete(null); queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
    onError: (err) => { toast.error(errorMessage(err)); setToDelete(null); },
  });

  const columns = [
    { key: 'shift_name', header: 'Shift', render: (s) => <span className="font-medium text-slate-700">{s.shift_name}</span> },
    { key: 'time', header: 'Timing', render: (s) => `${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)}` },
    { key: 'break_minutes', header: 'Break', render: (s) => `${s.break_minutes}m` },
    { key: 'grace_minutes', header: 'Grace', render: (s) => `${s.grace_minutes}m` },
    { key: 'weekly_off', header: 'Weekly Off', render: (s) => s.weekly_off || '—' },
    { key: 'employees_count', header: 'Employees', align: 'right', render: (s) => s.employees_count },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge tone={s.status === 'active' ? 'green' : 'gray'}>{s.status}</StatusBadge> },
    ...(canWrite ? [{
      key: 'actions', header: '', align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(s)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><FiEdit2 size={16} /></button>
          <button onClick={() => setToDelete(s)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={16} /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Shifts"
        breadcrumbs={[{ label: 'Attendance', to: '/attendance' }, { label: 'Shifts' }]}
        actions={canWrite && <button className="btn-primary" onClick={() => setEditing({})}><FiPlus /> Add Shift</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No shifts yet" />
      </div>

      <ShiftModal editing={editing} onClose={() => setEditing(null)} onSave={(v) => saveMutation.mutate(v)} saving={saveMutation.isPending} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => delMutation.mutate(toDelete.id)}
        title="Delete shift?" message={`Delete "${toDelete?.shift_name}"?`} confirmLabel="Delete" loading={delMutation.isPending}
      />
    </div>
  );
}

function ShiftModal({ editing, onClose, onSave, saving }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const open = editing !== null;

  useEffect(() => {
    if (open) reset({
      shift_name: editing.shift_name || '',
      start_time: editing.start_time?.slice(0, 5) || '09:00',
      end_time: editing.end_time?.slice(0, 5) || '18:00',
      break_minutes: editing.break_minutes ?? 60,
      grace_minutes: editing.grace_minutes ?? 15,
      weekly_off: editing.weekly_off || 'sunday',
    });
  }, [open, editing, reset]);

  return (
    <Modal open={open} onClose={onClose} title={editing?.id ? 'Edit Shift' : 'Add Shift'}
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" form="shift-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Save</button>
      </>}
    >
      <form id="shift-form" onSubmit={handleSubmit(onSave)} className="space-y-4">
        <Input label="Shift Name" required error={errors.shift_name} {...register('shift_name', { required: 'Name is required' })} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="time" label="Start Time" {...register('start_time')} />
          <Input type="time" label="End Time" {...register('end_time')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" label="Break (minutes)" {...register('break_minutes')} />
          <Input type="number" label="Grace (minutes)" {...register('grace_minutes')} />
        </div>
        <Input label="Weekly Off" placeholder="e.g. sunday" {...register('weekly_off')} />
      </form>
    </Modal>
  );
}
