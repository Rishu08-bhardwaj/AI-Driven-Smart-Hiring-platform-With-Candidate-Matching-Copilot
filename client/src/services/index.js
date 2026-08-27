import { api } from './apiClient.js';

const unwrap = (res) => res.data;

// ── Auth ───────────────────────────────────────────────────
export const authService = {
  login: (payload) => api.post('/auth/login', payload).then(unwrap),
  logout: () => api.post('/auth/logout').then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then(unwrap),
  resetPassword: (payload) => api.post('/auth/reset-password', payload).then(unwrap),
};

// ── Dashboard ──────────────────────────────────────────────
export const dashboardService = {
  stats: () => api.get('/dashboard/stats').then(unwrap),
  charts: (months = 6) => api.get('/dashboard/charts', { params: { months } }).then(unwrap),
  widgets: () => api.get('/dashboard/widgets').then(unwrap),
};

// ── Users (account management) ─────────────────────────────
export const userService = {
  list: (params) => api.get('/users', { params }).then(unwrap),
  get: (id) => api.get(`/users/${id}`).then(unwrap),
  create: (data) => api.post('/users', data).then(unwrap),
  update: (id, data) => api.put(`/users/${id}`, data).then(unwrap),
  setPassword: (id, password) => api.patch(`/users/${id}/password`, { password }).then(unwrap),
  remove: (id) => api.delete(`/users/${id}`).then(unwrap),
};

// ── Company settings ───────────────────────────────────────
export const companyService = {
  get: () => api.get('/company').then(unwrap),
  update: (data) => api.put('/company', data).then(unwrap),
};

// ── Audit logs ─────────────────────────────────────────────
export const auditService = {
  list: (params) => api.get('/audit-logs', { params }).then(unwrap),
  actions: () => api.get('/audit-logs/actions').then(unwrap),
};

// ── Reports ────────────────────────────────────────────────
export const reportService = {
  headcount: () => api.get('/reports/headcount').then(unwrap),
  attendance: (params) => api.get('/reports/attendance', { params }).then(unwrap),
  payroll: (params) => api.get('/reports/payroll', { params }).then(unwrap),
  leave: (params) => api.get('/reports/leave', { params }).then(unwrap),
};

// ── Employee self-service (portal) ─────────────────────────
export const meService = {
  dashboard: () => api.get('/me/dashboard').then(unwrap),
  profile: () => api.get('/me/profile').then(unwrap),
  updateProfile: (data) => api.put('/me/profile', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined).then(unwrap),
  attendance: (params) => api.get('/me/attendance', { params }).then(unwrap),
  leaves: () => api.get('/me/leaves').then(unwrap),
  leaveBalances: (params) => api.get('/me/leaves/balances', { params }).then(unwrap),
  leaveTypes: () => api.get('/me/leave-types').then(unwrap),
  applyLeave: (data) => api.post('/me/leaves', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined).then(unwrap),
  cancelLeave: (id, remarks) => api.patch(`/me/leaves/${id}/cancel`, { remarks }).then(unwrap),
  salary: () => api.get('/me/salary').then(unwrap),
  advances: () => api.get('/me/advances').then(unwrap),
  requestAdvance: (data) => api.post('/me/advances', data).then(unwrap),
  loans: () => api.get('/me/loans').then(unwrap),
  requestLoan: (data) => api.post('/me/loans', data).then(unwrap),
  documents: () => api.get('/me/documents').then(unwrap),
  /** Fetch own salary slip PDF and open it. */
  openSlip: async (id) => {
    const res = await api.get(`/me/salary/${id}/slip`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

// ── Employees ──────────────────────────────────────────────
export const employeeService = {
  list: (params) => api.get('/employees', { params }).then(unwrap),
  get: (id) => api.get(`/employees/${id}`).then(unwrap),
  nextCode: () => api.get('/employees/next-code').then(unwrap),
  create: (data) => api.post('/employees', data, multipartIfFile(data)).then(unwrap),
  update: (id, data) => api.put(`/employees/${id}`, data, multipartIfFile(data)).then(unwrap),
  remove: (id, archive = false) => api.delete(`/employees/${id}`, { params: { archive } }).then(unwrap),
  changeStatus: (id, status) => api.patch(`/employees/${id}/status`, { status }).then(unwrap),
  bulk: (payload) => api.post('/employees/bulk', payload).then(unwrap),
  salaryHistory: (id) => api.get(`/employees/${id}/salary-history`).then(unwrap),
  attendance: (id, params) => api.get(`/employees/${id}/attendance`, { params }).then(unwrap),
  leaves: (id) => api.get(`/employees/${id}/leaves`).then(unwrap),
  documents: (id) => api.get(`/employees/${id}/documents`).then(unwrap),
  timeline: (id) => api.get(`/employees/${id}/timeline`).then(unwrap),
  createAccount: (id, password) => api.post(`/employees/${id}/account`, password ? { password } : {}).then(unwrap),
  revokeAccount: (id) => api.delete(`/employees/${id}/account`).then(unwrap),
};

// ── Departments ────────────────────────────────────────────
export const departmentService = {
  list: (params) => api.get('/departments', { params }).then(unwrap),
  get: (id) => api.get(`/departments/${id}`).then(unwrap),
  create: (data) => api.post('/departments', data).then(unwrap),
  update: (id, data) => api.put(`/departments/${id}`, data).then(unwrap),
  remove: (id, moveTo) => api.delete(`/departments/${id}`, { params: { moveTo } }).then(unwrap),
  archive: (id) => api.patch(`/departments/${id}/archive`).then(unwrap),
  restore: (id) => api.patch(`/departments/${id}/restore`).then(unwrap),
};

// ── Designations ───────────────────────────────────────────
export const designationService = {
  list: (params) => api.get('/designations', { params }).then(unwrap),
  get: (id) => api.get(`/designations/${id}`).then(unwrap),
  create: (data) => api.post('/designations', data).then(unwrap),
  update: (id, data) => api.put(`/designations/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/designations/${id}`).then(unwrap),
  archive: (id) => api.patch(`/designations/${id}/archive`).then(unwrap),
  restore: (id) => api.patch(`/designations/${id}/restore`).then(unwrap),
};

// ── Notifications ──────────────────────────────────────────
export const notificationService = {
  list: (params) => api.get('/notifications', { params }).then(unwrap),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then(unwrap),
  markAllRead: () => api.patch('/notifications/read-all').then(unwrap),
};

// ── Shifts ─────────────────────────────────────────────────
export const shiftService = {
  list: (params) => api.get('/shifts', { params }).then(unwrap),
  create: (data) => api.post('/shifts', data).then(unwrap),
  update: (id, data) => api.put(`/shifts/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/shifts/${id}`).then(unwrap),
  assign: (id, employeeIds) => api.post(`/shifts/${id}/assign`, { employeeIds }).then(unwrap),
};

// ── Attendance ─────────────────────────────────────────────
export const attendanceService = {
  list: (params) => api.get('/attendance', { params }).then(unwrap),
  get: (id) => api.get(`/attendance/${id}`).then(unwrap),
  mark: (data) => api.post('/attendance', data).then(unwrap),
  bulk: (data) => api.post('/attendance/bulk', data).then(unwrap),
  correct: (id, data) => api.put(`/attendance/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/attendance/${id}`).then(unwrap),
  summary: (params) => api.get('/attendance/summary', { params }).then(unwrap),
  analytics: (params) => api.get('/attendance/analytics', { params }).then(unwrap),
};

// ── Leave ──────────────────────────────────────────────────
export const leaveService = {
  list: (params) => api.get('/leaves', { params }).then(unwrap),
  get: (id) => api.get(`/leaves/${id}`).then(unwrap),
  apply: (data) => api.post('/leaves', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined).then(unwrap),
  decide: (id, payload) => api.patch(`/leaves/${id}/decision`, payload).then(unwrap),
  cancel: (id, remarks) => api.patch(`/leaves/${id}/cancel`, { remarks }).then(unwrap),
  calendar: (params) => api.get('/leaves/calendar', { params }).then(unwrap),
  balances: (employeeId, params) => api.get(`/leaves/balances/${employeeId}`, { params }).then(unwrap),
  setAllocation: (data) => api.post('/leaves/balances', data).then(unwrap),
};

export const leaveTypeService = {
  list: (params) => api.get('/leave-types', { params }).then(unwrap),
  create: (data) => api.post('/leave-types', data).then(unwrap),
  update: (id, data) => api.put(`/leave-types/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/leave-types/${id}`).then(unwrap),
};

export const holidayService = {
  list: (params) => api.get('/holidays', { params }).then(unwrap),
  create: (data) => api.post('/holidays', data).then(unwrap),
  update: (id, data) => api.put(`/holidays/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/holidays/${id}`).then(unwrap),
};

// ── Payroll ────────────────────────────────────────────────
export const payrollService = {
  list: (params) => api.get('/payroll', { params }).then(unwrap),
  get: (id) => api.get(`/payroll/${id}`).then(unwrap),
  dashboard: (params) => api.get('/payroll/dashboard', { params }).then(unwrap),
  preview: (data) => api.post('/payroll/preview', data).then(unwrap),
  generate: (data) => api.post('/payroll/generate', data).then(unwrap),
  pay: (id, data) => api.post(`/payroll/${id}/pay`, data).then(unwrap),
  payments: (id) => api.get(`/payroll/${id}/payments`).then(unwrap),
  history: (id) => api.get(`/payroll/${id}/history`).then(unwrap),
  addComponent: (id, data) => api.post(`/payroll/${id}/components`, data).then(unwrap),
  lock: (id) => api.patch(`/payroll/${id}/lock`).then(unwrap),
  unlock: (id) => api.patch(`/payroll/${id}/unlock`).then(unwrap),
  revoke: (id) => api.delete(`/payroll/${id}`).then(unwrap),
  void: (id) => api.patch(`/payroll/${id}/void`).then(unwrap),
  settleVoid: (id, data) => api.patch(`/payroll/${id}/settle-void`, data).then(unwrap),
  /** Fetch the slip PDF (auth header attached) and open it in a new tab. */
  openSlip: async (id) => {
    const res = await api.get(`/payroll/${id}/slip`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

export const salaryProfileService = {
  get: (employeeId) => api.get(`/salary-profiles/${employeeId}`).then(unwrap),
  save: (employeeId, data) => api.put(`/salary-profiles/${employeeId}`, data).then(unwrap),
  withdrawPf: (employeeId, data) => api.post(`/salary-profiles/${employeeId}/pf-withdraw`, data).then(unwrap),
};

export const advanceService = {
  list: (params) => api.get('/advances', { params }).then(unwrap),
  create: (data) => api.post('/advances', data).then(unwrap),
  decide: (id, status) => api.patch(`/advances/${id}/decision`, { status }).then(unwrap),
  pay: (id, data) => api.post(`/advances/${id}/pay`, data).then(unwrap),
};

export const loanService = {
  list: (params) => api.get('/loans', { params }).then(unwrap),
  create: (data) => api.post('/loans', data).then(unwrap),
  approve: (id, data) => api.post(`/loans/${id}/approve`, data).then(unwrap),
  reject: (id) => api.post(`/loans/${id}/reject`).then(unwrap),
  remove: (id) => api.delete(`/loans/${id}`).then(unwrap),
};

/** Build multipart config + FormData when a File is present in the payload. */
function multipartIfFile(data) {
  if (data instanceof FormData) return { headers: { 'Content-Type': 'multipart/form-data' } };
  return undefined;
}
