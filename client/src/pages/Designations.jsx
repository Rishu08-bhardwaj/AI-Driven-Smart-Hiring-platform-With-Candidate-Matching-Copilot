import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { designationService, departmentService } from '../services/index.js';
import { errorMessage } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import DataTable from '../components/tables/DataTable.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { Input, Textarea, Select, Options } from '../components/forms/fields.jsx';

const schema = yup.object({
  designation_name: yup.string().trim().required('Name is required').max(120),
  department_id: yup.string().nullable(),
  level: yup.string().max(40).nullable(),
  description: yup.string().max(500).nullable(),
});

export default function Designations() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['designations'], queryFn: () => designationService.list() });
  const deptQ = useQuery({ queryKey: ['departments', 'active'], queryFn: () => departmentService.list({ status: 'active' }) });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?.id ? designationService.update(editing.id, values) : designationService.create(values)),
    onSuccess: (res) => {
      toast.success(res.message || 'Saved.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['designations'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const delMutation = useMutation({
    mutationFn: (id) => designationService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Deleted.');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['designations'] });
    },
    onError: (err) => { toast.error(errorMessage(err)); setToDelete(null); },
  });

  const columns = [
    { key: 'designation_name', header: 'Designation', render: (d) => <span className="font-medium text-slate-700">{d.designation_name}</span> },
    { key: 'department_name', header: 'Department', render: (d) => d.department_name || '—' },
    { key: 'level', header: 'Level', render: (d) => d.level || '—' },
    { key: 'employees_count', header: 'Employees', align: 'right', render: (d) => d.employees_count },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge tone={d.status === 'active' ? 'green' : 'gray'}>{d.status}</StatusBadge> },
    {
      key: 'actions', header: '', align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-1">
          {can('designation:update') && <button onClick={() => setEditing(d)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><FiEdit2 size={16} /></button>}
          {can('designation:delete') && <button onClick={() => setToDelete(d)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Designations"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Designations' }]}
        actions={can('designation:create') && <button className="btn-primary" onClick={() => setEditing({})}><FiPlus /> Add Designation</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No designations yet" />
      </div>

      <DesignationModal
        editing={editing}
        departments={deptQ.data?.data || []}
        onClose={() => setEditing(null)}
        onSave={(v) => saveMutation.mutate(v)}
        saving={saveMutation.isPending}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => delMutation.mutate(toDelete.id)}
        title="Delete designation?"
        message={`Delete "${toDelete?.designation_name}"? Designations assigned to employees must be reassigned first.`}
        confirmLabel="Delete"
        loading={delMutation.isPending}
      />
    </div>
  );
}

function DesignationModal({ editing, departments, onClose, onSave, saving }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(schema) });
  const open = editing !== null;

  useEffect(() => {
    if (open) {
      reset({
        designation_name: editing.designation_name || '',
        department_id: editing.department_id ?? '',
        level: editing.level || '',
        description: editing.description || '',
      });
    }
  }, [open, editing, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing?.id ? 'Edit Designation' : 'Add Designation'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" form="desig-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Save</button>
        </>
      }
    >
      <form id="desig-form" onSubmit={handleSubmit(onSave)} className="space-y-4">
        <Input label="Designation Name" required error={errors.designation_name} {...register('designation_name')} />
        <Select label="Department" error={errors.department_id} {...register('department_id')}>
          <Options map={departments.map((d) => ({ value: d.id, label: d.department_name }))} placeholder="Select department" />
        </Select>
        <Input label="Level" error={errors.level} {...register('level')} />
        <Textarea label="Description" error={errors.description} {...register('description')} />
      </form>
    </Modal>
  );
}
