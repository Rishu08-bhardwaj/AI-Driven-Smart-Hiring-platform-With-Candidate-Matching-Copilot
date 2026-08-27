import { Router } from 'express';
import * as ctrl from '../controllers/salaryProfile.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { profileRules } from '../middleware/validators/payroll.validators.js';

const router = Router();
router.use(authenticate);

router.get('/:employeeId', authorize('salaryprofile:read'), ctrl.getProfile);
router.put('/:employeeId', authorize('salaryprofile:write'), profileRules, validate, ctrl.upsertProfile);
// Settling/withdrawing the PF corpus is a financial disbursement → accountant/admin.
router.post('/:employeeId/pf-withdraw', authorize('payroll:write'), ctrl.withdrawPf);

export default router;
