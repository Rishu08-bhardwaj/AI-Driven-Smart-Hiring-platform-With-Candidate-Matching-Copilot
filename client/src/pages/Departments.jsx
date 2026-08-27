import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { departmentService } from '../services/index.js';
import { errorMessage } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import DataTable from '../components/tables/DataTable.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { Input, Textarea } from '../components/forms/fields.jsx';

const schema = yup.object({
  department_name: yup.string().trim().required('Name is required').max(120),
  department_code: yup.string().max(40).nullable(),
  description: yup.string().max(500).nullable(),
});

export default function Departments() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | {} (new) | record
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['departments'], queryFn: () => departmentService.list() });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?.id ? departmentService.update(editing.id, values) : departmentService.create(values)),
    onSuccess: (res) => {
      toast.success(res.message || 'Saved.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const delMutation = useMutation({
    mutationFn: (id) => departmentService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Deleted.');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err) => { toast.error(errorMessage(err)); setToDelete(null); },
  });

  const columns = [
    { key: 'department_name', header: 'Department', render: (d) => <span className="font-medium text-slate-700">{d.department_name}</span> },
    { key: 'department_code', header: 'Code', render: (d) => d.department_code || '—' },
    { key: 'head_name', header: 'Head', render: (d) => d.head_name || '—' },
    { key: 'employees_count', header: 'Employees', align: 'right', render: (d) => d.employees_count },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge tone={d.status === 'active' ? 'green' : 'gray'}>{d.status}</StatusBadge> },
    {
      key: 'actions', header: '', align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-1">
          {can('department:update') && <button onClick={() => setEditing(d)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><FiEdit2 size={16} /></button>}
          {can('department:delete') && <button onClick={() => setToDelete(d)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Departments' }]}
        actions={can('department:create') && <button className="btn-primary" onClick={() => setEditing({})}><FiPlus /> Add Department</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No departments yet" />
      </div>

      <DepartmentModal editing={editing} onClose={() => setEditing(null)} onSave={(v) => saveMutation.mutate(v)} saving={saveMutation.isPending} schema={schema} />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => delMutation.mutate(toDelete.id)}
        title="Delete department?"
        message={`Delete "${toDelete?.department_name}"? Departments with employees must have them reassigned first.`}
        confirmLabel="Delete"
        loading={delMutation.isPending}
      />
    </div>
  );
}

function DepartmentModal({ editing, onClose, onSave, saving, schema }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(schema) });
  const open = editing !== null;

  // Reset form fields whenever the modal opens for a (different) record.
  useEffect(() => {
    if (open) {
      reset({
        department_name: editing.department_name || '',
        department_code: editing.department_code || '',
        description: editing.description || '',
      });
    }
  }, [open, editing, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing?.id ? 'Edit Department' : 'Add Department'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" form="dept-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Save</button>
        </>
      }
    >
      <form id="dept-form" onSubmit={handleSubmit(onSave)} className="space-y-4">
        <Input label="Department Name" required error={errors.department_name} {...register('department_name')} />
        <Input label="Department Code" error={errors.department_code} {...register('department_code')} />
        <Textarea label="Description" error={errors.description} {...register('description')} />
      </form>
    </Modal>
  );
}
