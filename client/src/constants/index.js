// Centralized option lists & label maps shared across the app.

export const ROLES = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  hr: 'HR Manager',
  accountant: 'Accountant',
  employee: 'Employee',
};

export const EMPLOYEE_STATUS = {
  active: { label: 'Active', tone: 'green' },
  inactive: { label: 'Inactive', tone: 'gray' },
  on_leave: { label: 'On Leave', tone: 'blue' },
  resigned: { label: 'Resigned', tone: 'amber' },
  terminated: { label: 'Terminated', tone: 'red' },
  retired: { label: 'Retired', tone: 'slate' },
};

export const EMPLOYMENT_TYPES = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  intern: 'Intern',
  contract: 'Contract',
  temporary: 'Temporary',
  freelancer: 'Freelancer',
};

export const SALARY_TYPES = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  daily: 'Daily',
  hourly: 'Hourly',
};

export const PAYMENT_STATUS = {
  generated: { label: 'Generated', tone: 'slate' },
  pending: { label: 'Pending', tone: 'amber' },
  partial: { label: 'Partially Paid', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  refunded: { label: 'Refunded', tone: 'red' },
};

export const ATTENDANCE_STATUS = {
  present: { label: 'Present', tone: 'green' },
  absent: { label: 'Absent', tone: 'red' },
  half_day: { label: 'Half Day', tone: 'amber' },
  paid_leave: { label: 'Paid Leave', tone: 'blue' },
  unpaid_leave: { label: 'Unpaid Leave', tone: 'slate' },
  holiday: { label: 'Holiday', tone: 'gray' },
  weekend: { label: 'Weekend', tone: 'gray' },
  wfh: { label: 'WFH', tone: 'blue' },
  late: { label: 'Late', tone: 'amber' },
  early_exit: { label: 'Early Exit', tone: 'amber' },
};

export const LEAVE_STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export const GENDERS = { male: 'Male', female: 'Female', other: 'Other' };

export const PAGE_SIZE = 10;

/** Format a number as INR currency. */
export function formatCurrency(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

/** Format an ISO date string as a readable date. */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
