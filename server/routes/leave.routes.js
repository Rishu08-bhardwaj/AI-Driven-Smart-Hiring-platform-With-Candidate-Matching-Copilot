import { Router } from 'express';
import * as ctrl from '../controllers/leave.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploader } from '../middleware/upload.js';
import { applyLeaveRules, decisionRules, allocationRules } from '../middleware/validators/leave.validators.js';

const router = Router();
router.use(authenticate);

const attachmentUpload = uploader('leaves');

router.get('/', authorize('leave:read'), ctrl.listLeaves);
router.get('/calendar', authorize('leave:read'), ctrl.calendar);
router.get('/balances/:employeeId', authorize('leave:read'), ctrl.balances);
router.post('/balances', authorize('leave:write'), allocationRules, validate, ctrl.setAllocation);

router.post('/', authorize('leave:write'), ...attachmentUpload.single('attachment'), applyLeaveRules, validate, ctrl.applyLeave);
router.get('/:id', authorize('leave:read'), ctrl.getLeave);
router.patch('/:id/decision', authorize('leave:approve'), decisionRules, validate, ctrl.decideLeave);
router.patch('/:id/cancel', authorize('leave:write'), ctrl.cancelLeave);

export default router;
