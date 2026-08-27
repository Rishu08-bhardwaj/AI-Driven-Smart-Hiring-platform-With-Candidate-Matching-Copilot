import { Router } from 'express';
import * as ctrl from '../controllers/payroll.controller.js';
import * as dash from '../controllers/payrollDashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { periodRules, payRules, componentRules } from '../middleware/validators/payroll.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('payroll:read'), ctrl.listPayroll);
router.get('/dashboard', authorize('payroll:read'), dash.payrollDashboard);

router.post('/preview', authorize('payroll:generate'), periodRules, validate, ctrl.previewPayroll);
router.post('/generate', authorize('payroll:generate'), periodRules, validate, ctrl.generatePayroll);

router.get('/:id', authorize('payroll:read'), ctrl.getPayroll);
router.get('/:id/payments', authorize('payroll:read'), ctrl.paymentHistory);
router.get('/:id/history', authorize('payroll:read'), ctrl.payrollHistory);
router.get('/:id/slip', authorize('payroll:read'), dash.downloadSlip);

router.post('/:id/pay', authorize('payment:write'), payRules, validate, ctrl.paySalary);
router.post('/:id/components', authorize('payroll:write'), componentRules, validate, ctrl.addComponent);
router.patch('/:id/lock', authorize('payroll:lock'), ctrl.lockPayroll);
router.patch('/:id/unlock', authorize('payroll:unlock'), ctrl.unlockPayroll);
router.delete('/:id', authorize('payroll:revoke'), ctrl.deletePayroll);
router.patch('/:id/void', authorize('payroll:void'), ctrl.voidPayroll);
router.patch('/:id/settle-void', authorize('payroll:void'), ctrl.settleVoid);

export default router;
