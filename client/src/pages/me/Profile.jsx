import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { meService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatDate } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { Input } from '../../components/forms/fields.jsx';

export default function MyProfile() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['me', 'profile'], queryFn: () => meService.profile() });
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { if (data?.data) reset(data.data); }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => meService.updateProfile(values),
    onSuccess: (res) => {
      toast.success(res.message || 'Profile updated.');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (isError) return <ErrorState message="Failed to load your profile." onRetry={refetch} />;

  const e = data?.data || {};
  const readOnly = [
    ['Employee ID', e.employee_code],
    ['Department', e.department_name || '—'],
    ['Designation', e.designation_name || '—'],
    ['Joining Date', e.joining_date ? formatDate(e.joining_date) : '—'],
    ['Employment Type', e.employment_type],
    ['Email', e.email || '—'],
  ];

  return (
    <div>
      <PageHeader title="My Profile" subtitle="View your details and update personal contact information." />

      <div className="mb-6 card flex items-center gap-4 p-5">
        <Avatar name={`${e.first_name} ${e.last_name || ''}`} src={e.photo_url} size={64} />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{e.first_name} {e.last_name}</h2>
          <p className="text-sm text-slate-500">{e.designation_name} {e.department_name ? `· ${e.department_name}` : ''}</p>
        </div>
      </div>

      {/* Read-only employment info */}
      <div className="mb-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Employment Details <span className="font-normal text-slate-400">(managed by HR)</span></h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {readOnly.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-sm font-medium text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Editable personal info */}
      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Personal Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" {...register('phone')} />
          <Input label="Alternate Phone" {...register('alternate_phone')} />
          <Input label="Current Address" className="sm:col-span-2" {...register('current_address')} />
          <Input label="Permanent Address" className="sm:col-span-2" {...register('permanent_address')} />
          <Input label="City" {...register('city')} />
          <Input label="State" {...register('state')} />
          <Input label="Country" {...register('country')} />
          <Input label="Zip Code" {...register('zip_code')} />
          <Input label="Emergency Contact Name" {...register('emergency_name')} />
          <Input label="Emergency Contact Phone" {...register('emergency_phone')} />
          <Input label="Emergency Contact Relation" {...register('emergency_relation')} />
        </div>
        <div className="mt-5 flex justify-end">
          <button className="btn-primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Spinner size={16} className="text-white" />} Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
