import {
  FiGrid, FiUsers, FiBriefcase, FiTag, FiClock, FiCalendar,
  FiDollarSign, FiFileText, FiSettings, FiShield, FiUser, FiFolder,
} from 'react-icons/fi';

/**
 * Sidebar navigation. `perm` gates visibility against the user's role.
 *
 * Staff items (admin/hr/accountant) and employee self-service items live in the
 * same list — their permissions are disjoint (`self:*` vs org-wide), so each
 * role only ever sees the items it is allowed to use.
 */
export const NAV_ITEMS = [
  // ── Staff workspace ──
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid, perm: 'dashboard:read' },
  { to: '/employees', label: 'Employees', icon: FiUsers, perm: 'employee:read' },
  { to: '/departments', label: 'Departments', icon: FiBriefcase, perm: 'department:read' },
  { to: '/designations', label: 'Designations', icon: FiTag, perm: 'designation:read' },
  { to: '/attendance', label: 'Attendance', icon: FiClock, perm: 'attendance:read' },
  { to: '/leaves', label: 'Leave', icon: FiCalendar, perm: 'leave:read' },
  { to: '/payroll', label: 'Payroll', icon: FiDollarSign, perm: 'payroll:read' },
  { to: '/reports', label: 'Reports', icon: FiFileText, perm: 'report:read' },
  { to: '/users', label: 'Users', icon: FiUser, perm: 'user:read' },
  { to: '/audit-logs', label: 'Audit Logs', icon: FiShield, perm: 'audit:read' },
  { to: '/settings', label: 'Company Settings', icon: FiSettings, perm: 'company:read' },

  // ── Employee self-service ──
  { to: '/me/dashboard', label: 'Dashboard', icon: FiGrid, perm: 'self:dashboard:read' },
  { to: '/me/profile', label: 'My Profile', icon: FiUser, perm: 'self:profile:read' },
  { to: '/me/attendance', label: 'My Attendance', icon: FiClock, perm: 'self:attendance:read' },
  { to: '/me/leaves', label: 'My Leave', icon: FiCalendar, perm: 'self:leave:read' },
  { to: '/me/salary', label: 'My Salary', icon: FiDollarSign, perm: 'self:salary:read' },
  { to: '/me/documents', label: 'My Documents', icon: FiFolder, perm: 'self:document:read' },
];
