import { Router } from 'express';
import * as ctrl from '../controllers/advance.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { advanceRules } from '../middleware/validators/payroll.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('advance:read'), ctrl.listAdvances);
router.get('/:id', authorize('advance:read'), ctrl.getAdvance);
router.post('/', authorize('advance:write'), advanceRules, validate, ctrl.createAdvance);
router.patch('/:id/decision', authorize('advance:approve'), ctrl.decideAdvance);
router.post('/:id/pay', authorize('advance:write'), ctrl.payAdvance);

export default router;
