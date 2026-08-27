import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiSave, FiUpload } from 'react-icons/fi';
import { employeeService, departmentService, designationService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { employeeSchema } from '../../validations/employee.js';
import { EMPLOYMENT_TYPES, SALARY_TYPES, GENDERS, EMPLOYEE_STATUS } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { Input, Select, Textarea, Options } from '../../components/forms/fields.jsx';

const Section = ({ title, children }) => (
  <div className="card p-5">
    <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700">{title}</h3>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </div>
);

export default function EmployeeForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ resolver: yupResolver(employeeSchema), defaultValues: { employment_type: 'full_time', salary_type: 'monthly', status: 'active' } });

  const deptId = watch('department_id');

  const deptQ = useQuery({ queryKey: ['departments', 'active'], queryFn: () => departmentService.list({ status: 'active' }) });
  const desigQ = useQuery({ queryKey: ['designations', 'active'], queryFn: () => designationService.list({ status: 'active' }) });
  const codeQ = useQuery({ queryKey: ['employee-code'], queryFn: employeeService.nextCode, enabled: !isEdit });
  const employeeQ = useQuery({ queryKey: ['employee', id], queryFn: () => employeeService.get(id), enabled: isEdit });

  // Populate the form on edit.
  useEffect(() => {
    if (employeeQ.data?.data) {
      const e = employeeQ.data.data;
      reset({
        ...e,
        department_id: e.department_id ?? '',
        designation_id: e.designation_id ?? '',
        dob: e.dob ?? '',
        joining_date: e.joining_date ?? '',
      });
      if (e.photo_url) setPhotoPreview(e.photo_url);
    }
  }, [employeeQ.data, reset]);

  const designations = (desigQ.data?.data || []).filter((d) => !deptId || String(d.department_id) === String(deptId));

  const mutation = useMutation({
    mutationFn: (values) => {
      const payload = buildPayload(values, photo);
      return isEdit ? employeeService.update(id, payload) : employeeService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Saved.');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/employees/${res.data.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  if (isEdit && employeeQ.isLoading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        breadcrumbs={[{ label: 'Employees', to: '/employees' }, { label: isEdit ? 'Edit' : 'New' }]}
      />

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        <Section title="Personal Information">
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-4">
            <Avatar src={photoPreview} name={watch('first_name') || 'New'} size={64} />
            <div>
              <input type="file" accept="image/*" ref={fileRef} onChange={onPhoto} className="hidden" />
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><FiUpload /> Upload photo</button>
              <p className="mt-1 text-xs text-slate-400">JPG/PNG up to 5MB</p>
            </div>
          </div>
          <Input label="Employee Code" value={isEdit ? watch('employee_code') || '' : codeQ.data?.data?.employee_code || 'Auto'} readOnly disabled />
          <Input label="First Name" required error={errors.first_name} {...register('first_name')} />
          <Input label="Middle Name" error={errors.middle_name} {...register('middle_name')} />
          <Input label="Last Name" error={errors.last_name} {...register('last_name')} />
          <Select label="Gender" error={errors.gender} {...register('gender')}><Options map={GENDERS} placeholder="Select gender" /></Select>
          <Input type="date" label="Date of Birth" error={errors.dob} {...register('dob')} />
          <Input label="Blood Group" {...register('blood_group')} />
          <Input label="Nationality" {...register('nationality')} />
        </Section>

        <Section title="Contact Information">
          <Input label="Phone" error={errors.phone} {...register('phone')} />
          <Input label="Alternate Phone" error={errors.alternate_phone} {...register('alternate_phone')} />
          <Input type="email" label="Email" error={errors.email} {...register('email')} />
          <Input label="Emergency Contact Name" {...register('emergency_name')} />
          <Input label="Emergency Contact Number" {...register('emergency_phone')} />
          <Input label="Relationship" {...register('emergency_relation')} />
          <Input label="City" {...register('city')} />
          <Input label="State" {...register('state')} />
          <Input label="ZIP Code" {...register('zip_code')} />
          <Textarea label="Current Address" className="sm:col-span-2 lg:col-span-3" {...register('current_address')} />
        </Section>

        <Section title="Employment Information">
          <Input type="date" label="Joining Date" error={errors.joining_date} {...register('joining_date')} />
          <Select label="Department" {...register('department_id')}>
            <Options map={(deptQ.data?.data || []).map((d) => ({ value: d.id, label: d.department_name }))} placeholder="Select department" />
          </Select>
          <Select label="Designation" {...register('designation_id')}>
            <Options map={designations.map((d) => ({ value: d.id, label: d.designation_name }))} placeholder="Select designation" />
          </Select>
          <Input label="Work Location" {...register('work_location')} />
          <Input label="Shift" {...register('shift')} />
          <Select label="Employment Type" {...register('employment_type')}><Options map={EMPLOYMENT_TYPES} includeEmpty={false} /></Select>
          <Select label="Status" {...register('status')}><Options map={Object.fromEntries(Object.entries(EMPLOYEE_STATUS).map(([k, v]) => [k, v.label]))} includeEmpty={false} /></Select>
        </Section>

        <Section title="Salary Information">
          <Input type="number" step="0.01" label="Monthly Salary" error={errors.salary} {...register('salary')} />
          <Select label="Salary Type" {...register('salary_type')}><Options map={SALARY_TYPES} includeEmpty={false} /></Select>
          <Input label="Bank Name" {...register('bank_name')} />
          <Input label="Account Holder Name" {...register('account_holder_name')} />
          <Input label="Account Number" {...register('account_number')} />
          <Input label="IFSC Code" {...register('ifsc')} />
          <Input label="UPI ID" {...register('upi_id')} />
        </Section>

        <Section title="Government Information">
          <Input label="Aadhaar Number" {...register('aadhaar_number')} />
          <Input label="PAN Number" {...register('pan_number')} />
          <Input label="Passport Number" {...register('passport_number')} />
          <Input label="Driving License" {...register('driving_license')} />
          <Input label="ESI Number" {...register('esi_number')} />
          <Input label="PF Number" {...register('pf_number')} />
        </Section>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner size={16} className="text-white" /> : <FiSave />}
            {isEdit ? 'Save changes' : 'Create employee'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Build a FormData (multipart) when a photo is attached, else a clean JSON object. */
function buildPayload(values, photo) {
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null));
  delete clean.employee_code; // server owns the code
  if (photo) {
    const fd = new FormData();
    Object.entries(clean).forEach(([k, v]) => fd.append(k, v));
    fd.append('photo', photo);
    return fd;
  }
  return clean;
}
