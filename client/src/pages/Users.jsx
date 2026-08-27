import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiKey } from 'react-icons/fi';
import { userService } from '../services/index.js';
import { errorMessage } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import DataTable from '../components/tables/DataTable.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { Input, Select, Options } from '../components/forms/fields.jsx';

// Super Admin can assign any role; everyone else cannot create Super Admins.
function assignableRoles(actorRole) {
  const all = { ...ROLES };
  if (actorRole !== 'super_admin') delete all.super_admin;
  return all;
}

export default function Users() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [resetting, setResetting] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list({ limit: 100 }),
  });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?.id ? userService.update(editing.id, values) : userService.create(values)),
    onSuccess: (res) => {
      toast.success(res.message || 'Saved.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const delMutation = useMutation({
    mutationFn: (id) => userService.remove(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Deleted.');
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => { toast.error(errorMessage(err)); setToDelete(null); },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }) => userService.setPassword(id, password),
    onSuccess: (res) => { toast.success(res.message || 'Password updated.'); setResetting(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns = [
    { key: 'name', header: 'Name', render: (u) => <span className="font-medium text-slate-700">{u.name}</span> },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{ROLES[u.role] || u.role}</span> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status}</StatusBadge> },
    { key: 'last_login_at', header: 'Last login', render: (u) => (u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—') },
    {
      key: 'actions', header: '', align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-1">
          {can('user:update') && <button title="Edit" onClick={() => setEditing(u)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><FiEdit2 size={16} /></button>}
          {can('user:update') && <button title="Reset password" onClick={() => setResetting(u)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600"><FiKey size={16} /></button>}
          {can('user:delete') && u.id !== user?.id && <button title="Delete" onClick={() => setToDelete(u)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={16} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage login accounts and roles."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Users' }]}
        actions={can('user:create') && <button className="btn-primary" onClick={() => setEditing({})}><FiPlus /> Add User</button>}
      />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No users yet" />
      </div>

      <UserModal editing={editing} actorRole={user?.role} onClose={() => setEditing(null)} onSave={(v) => saveMutation.mutate(v)} saving={saveMutation.isPending} />
      <ResetPasswordModal target={resetting} onClose={() => setResetting(null)} onSave={(p) => resetMutation.mutate({ id: resetting.id, password: p })} saving={resetMutation.isPending} />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => delMutation.mutate(toDelete.id)}
        title="Delete user?"
        message={`Delete the account for "${toDelete?.name}"? They will lose access immediately.`}
        confirmLabel="Delete"
        loading={delMutation.isPending}
      />
    </div>
  );
}

function UserModal({ editing, actorRole, onClose, onSave, saving }) {
  const isEdit = !!editing?.id;
  const schema = yup.object({
    name: yup.string().trim().required('Name is required').max(120),
    email: isEdit ? yup.string() : yup.string().email('Valid email required').required('Email is required'),
    password: isEdit ? yup.string() : yup.string().min(8, 'Min 8 characters').required('Password is required'),
    role: yup.string().required('Role is required'),
    status: yup.string().required(),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(schema) });
  const open = editing !== null;

  useEffect(() => {
    if (open) reset({ name: editing.name || '', email: editing.email || '', password: '', role: editing.role || 'employee', status: editing.status || 'active' });
  }, [open, editing, reset]);

  const submit = (values) => {
    const payload = isEdit
      ? { name: values.name, role: values.role, status: values.status }
      : values;
    onSave(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit User' : 'Add User'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" form="user-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Save</button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <Input label="Full Name" required error={errors.name} {...register('name')} />
        <Input label="Email" required={!isEdit} disabled={isEdit} error={errors.email} {...register('email')} />
        {!isEdit && <Input label="Password" type="password" required error={errors.password} {...register('password')} />}
        <Select label="Role" required error={errors.role} {...register('role')}>
          <Options map={assignableRoles(actorRole)} includeEmpty={false} />
        </Select>
        <Select label="Status" required error={errors.status} {...register('status')}>
          <Options map={{ active: 'Active', inactive: 'Inactive' }} includeEmpty={false} />
        </Select>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ target, onClose, onSave, saving }) {
  const schema = yup.object({ password: yup.string().min(8, 'Min 8 characters').required('Password is required') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(schema) });
  const open = target !== null;
  useEffect(() => { if (open) reset({ password: '' }); }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reset password — ${target?.name || ''}`}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" form="reset-form" disabled={saving}>{saving && <Spinner size={16} className="text-white" />} Update</button>
        </>
      }
    >
      <form id="reset-form" onSubmit={handleSubmit((v) => onSave(v.password))} className="space-y-4">
        <Input label="New Password" type="password" required error={errors.password} {...register('password')} />
      </form>
    </Modal>
  );
}
