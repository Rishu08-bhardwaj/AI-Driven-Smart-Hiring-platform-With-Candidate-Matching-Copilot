import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import meRoutes from './me.routes.js';
import employeeRoutes from './employee.routes.js';
import departmentRoutes from './department.routes.js';
import designationRoutes from './designation.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import notificationRoutes from './notification.routes.js';
import shiftRoutes from './shift.routes.js';
import attendanceRoutes from './attendance.routes.js';
import leaveTypeRoutes from './leaveType.routes.js';
import leaveRoutes from './leave.routes.js';
import holidayRoutes from './holiday.routes.js';
import payrollRoutes from './payroll.routes.js';
import salaryProfileRoutes from './salaryProfile.routes.js';
import advanceRoutes from './advance.routes.js';
import loanRoutes from './loan.routes.js';
import companyRoutes from './company.routes.js';
import auditRoutes from './audit.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

router.get('/health', (req, res) =>
  res.json({ success: true, message: 'HRMS API is healthy', timestamp: new Date().toISOString() })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/me', meRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/designations', designationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/shifts', shiftRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-types', leaveTypeRoutes);
router.use('/leaves', leaveRoutes);
router.use('/holidays', holidayRoutes);
router.use('/payroll', payrollRoutes);
router.use('/salary-profiles', salaryProfileRoutes);
router.use('/advances', advanceRoutes);
router.use('/loans', loanRoutes);
router.use('/company', companyRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/reports', reportRoutes);

export default router;
