import * as yup from 'yup';

const phone = yup
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .matches(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number')
  .nullable();

export const employeeSchema = yup.object({
  first_name: yup.string().trim().required('First name is required').max(80),
  middle_name: yup.string().max(80).nullable(),
  last_name: yup.string().max(80).nullable(),
  email: yup.string().transform((v) => (v === '' ? undefined : v)).email('Enter a valid email').nullable(),
  phone,
  alternate_phone: phone,
  gender: yup.string().oneOf(['', 'male', 'female', 'other']).nullable(),
  dob: yup.string().nullable(),
  joining_date: yup.string().nullable(),
  salary: yup
    .number()
    .transform((v, o) => (o === '' ? undefined : v))
    .min(0, 'Salary must be positive')
    .typeError('Salary must be a number')
    .nullable(),
  salary_type: yup.string().oneOf(['', 'monthly', 'weekly', 'daily', 'hourly']).nullable(),
  employment_type: yup.string().oneOf(['', 'full_time', 'part_time', 'intern', 'contract', 'temporary', 'freelancer']).nullable(),
  status: yup.string().nullable(),
  department_id: yup.string().nullable(),
  designation_id: yup.string().nullable(),
});
