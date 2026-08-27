import { Router } from 'express';
import * as ctrl from '../controllers/me.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploader } from '../middleware/upload.js';
import { selfApplyLeaveRules } from '../middleware/validators/leave.validators.js';
import { selfAdvanceRules, selfLoanRules } from '../middleware/validators/payroll.validators.js';

const router = Router();
router.use(authenticate);

const photoUpload = uploader('employees');
const attachmentUpload = uploader('leaves');

// Profile
router.get('/profile', authorize('self:profile:read'), ctrl.getProfile);
router.put('/profile', authorize('self:profile:update'), ...photoUpload.single('photo'), ctrl.updateProfile);

// Dashboard
router.get('/dashboard', authorize('self:dashboard:read'), ctrl.dashboard);

// Attendance
router.get('/attendance', authorize('self:attendance:read'), ctrl.attendance);

// Leave
router.get('/leaves', authorize('self:leave:read'), ctrl.leaves);
router.get('/leaves/balances', authorize('self:leave:read'), ctrl.leaveBalances);
router.get('/leave-types', authorize('self:leave:read'), ctrl.leaveTypes);
router.post('/leaves', authorize('self:leave:apply'), ...attachmentUpload.single('attachment'), selfApplyLeaveRules, validate, ctrl.applyLeave);
router.patch('/leaves/:id/cancel', authorize('self:leave:cancel'), ctrl.cancelLeave);

// Salary
router.get('/salary', authorize('self:salary:read'), ctrl.salary);
router.get('/salary/:id/slip', authorize('self:slip:download'), ctrl.downloadSlip);

// Salary advances (request + view own)
router.get('/advances', authorize('self:advance:read'), ctrl.advances);
router.post('/advances', authorize('self:advance:request'), selfAdvanceRules, validate, ctrl.requestAdvance);

// Loans (request + view own)
router.get('/loans', authorize('self:loan:read'), ctrl.loans);
router.post('/loans', authorize('self:loan:request'), selfLoanRules, validate, ctrl.requestLoan);

// Documents
router.get('/documents', authorize('self:document:read'), ctrl.documents);

export default router;
