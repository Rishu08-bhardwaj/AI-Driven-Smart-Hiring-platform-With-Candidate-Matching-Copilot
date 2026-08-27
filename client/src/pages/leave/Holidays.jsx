import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { holidayService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatDate } from '../../constants/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { Input, Select, Textarea, Options } from '../../components/forms/fields.jsx';

const TYPE_TONE = { national: 'blue', state: 'violet', company: 'slate' };
const year = new Date().getFullYear();

export default function Holidays() {
  const { can } = useAuth();
  const canWrite = can('holiday:write');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [filterYear, setFilterYear] = useState(year);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['holidays', filterYear], queryFn: () => holidayService.list({ year: filterYear }) });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?.id ? holidayService.update(editing.id, values) : holidayService.create(values)),
    onSuccess: (res) => { toast.success(res.message || 'Saved.'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['holidays'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const delMutation = useMutation({
    mutationFn: (id) => holidayService.remove(id),
    onSuccess: (res) => { toast.success(res.message || 'Deleted.'); setToDelete(null); queryClient.invalidateQueries({ queryKey: ['holidays'] }); },
    onError: (err) => { toast.error(errorMessage(err)); setToDelete(null); },
  });

  const columns = [
    { key: 'holiday_date', header: 'Date', render: (h) => formatDate(h.holiday_date) },
    { key: 'name', header: 'Holiday', render: (h) => <span className="font-medium text-slate-700">{h.name}</span> },
    { key: 'holiday_type', header: 'Type', render: (h) => <StatusBadge tone={TYPE_TONE[h.holiday_type]}>{h.holiday_type}</StatusBadge> },
    { key: 'recurring', header: 'Recurring', render: (h) => (h.recurring ? 'Yes' : 'No') },
    { key: 'description', header: 'Description', render: (h) => h.description || '—' },
    ...(canWrite ? [{
      key: 'actions', header: '', align: 'right',
      render: (h) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(h)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><FiEdit2 size={16} /></button>
          <button onClick={() => setToDelete(h)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={16} /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Holidays"
        breadcrumbs={[{ label: 'Leave', to: '/leaves' }, { label: 'Holidays' }]}
        actions={
          <div className="flex items-center gap-2">
            <select className="input w-28" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {canWrite && <button className="btn-primary" onClick={() => setEditing({})}><FiPlus /> Add Holiday</button>}
          </div>
        }
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No holidays for this year" />
      </div>

      <HolidayModal editing={editing} onClose={() => setEditing(null)} onSave={(v) => saveMutation.mutate(v)} saving={saveMutation.isPending} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => delMutation.mutate(toDelete.id)} title="Delete holiday?" message={`Delete "${toDelete?.name}"?`} confirmLabel="Delete" loading={delMutation.isPending} />
    </div>
  );
}

function HolidayModal({ editing, onClose, onSave, saving }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const open = editing !== null;
  useEffect(() => {
    if (open) reset({
      name: editing.name || '', holiday_date: editing.holiday_date || '',
      holiday_type: editing.holiday_type || 'company', recurring: editing.recurring ?? false,
      description: editing.description || '',
    });
  }, [open, editing, reset]);

  return (
    <Modal open={open} onClose={onClose} title={editing?.id ? 'Edit Holiday' : 'Add Holiday'}
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" form="hol-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Save</button>
      </>}
    >
      <form id="hol-form" onSubmit={handleSubmit((v) => onSave({ ...v, recurring: !!v.recurring }))} className="space-y-4">
        <Input label="Holiday Name" required error={errors.name} {...register('name', { required: 'Name is required' })} />
        <Input type="date" label="Date" required error={errors.holiday_date} {...register('holiday_date', { required: 'Date is required' })} />
        <Select label="Type" {...register('holiday_type')}>
          <Options map={{ national: 'National', state: 'State', company: 'Company' }} includeEmpty={false} />
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="rounded border-slate-300 text-brand-600" {...register('recurring')} /> Recurring every year
        </label>
        <Textarea label="Description" {...register('description')} />
      </form>
    </Modal>
  );
}
