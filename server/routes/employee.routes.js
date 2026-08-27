import { Router } from 'express';
import * as ctrl from '../controllers/employee.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploader } from '../middleware/upload.js';
import { employeeRules, statusRules, bulkRules } from '../middleware/validators/employee.validators.js';

const router = Router();
router.use(authenticate);

const photoUpload = uploader('employees');

router.get('/', authorize('employee:read'), ctrl.listEmployees);
router.get('/next-code', authorize('employee:read'), ctrl.nextCode);
router.post('/bulk', authorize('employee:update'), bulkRules, validate, ctrl.bulkAction);

router.get('/:id', authorize('employee:read'), ctrl.getEmployee);
router.get('/:id/salary-history', authorize('employee:read'), ctrl.salaryHistory);
router.get('/:id/attendance', authorize('employee:read'), ctrl.attendance);
router.get('/:id/leaves', authorize('employee:read'), ctrl.leaveHistory);
router.get('/:id/documents', authorize('employee:read'), ctrl.documents);
router.get('/:id/timeline', authorize('employee:read'), ctrl.timeline);

router.post('/', authorize('employee:create'), ...photoUpload.single('photo'), employeeRules, validate, ctrl.createEmployee);
router.put('/:id', authorize('employee:update'), ...photoUpload.single('photo'), employeeRules, validate, ctrl.updateEmployee);
router.patch('/:id/status', authorize('employee:update'), statusRules, validate, ctrl.changeStatus);
router.delete('/:id', authorize('employee:delete'), ctrl.deleteEmployee);

// Self-service login provisioning (Admin/HR)
router.post('/:id/account', authorize('employee:update'), ctrl.createAccount);
router.delete('/:id/account', authorize('employee:update'), ctrl.revokeAccount);

export default router;
