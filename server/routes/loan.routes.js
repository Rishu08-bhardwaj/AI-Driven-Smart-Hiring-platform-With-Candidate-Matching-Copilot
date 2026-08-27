import { Router } from 'express';
import * as ctrl from '../controllers/loan.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { loanRules, approveLoanRules } from '../middleware/validators/payroll.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('loan:read'), ctrl.listLoans);
router.get('/:id', authorize('loan:read'), ctrl.getLoan);
router.post('/', authorize('loan:write'), loanRules, validate, ctrl.createLoan);
router.post('/:id/approve', authorize('loan:write'), approveLoanRules, validate, ctrl.approveLoan);
router.post('/:id/reject', authorize('loan:write'), ctrl.rejectLoan);
router.delete('/:id', authorize('loan:write'), ctrl.deleteLoan);

export default router;
