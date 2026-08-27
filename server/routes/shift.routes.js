import { Router } from 'express';
import * as ctrl from '../controllers/shift.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { shiftRules } from '../middleware/validators/attendance.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('shift:read'), ctrl.listShifts);
router.get('/:id', authorize('shift:read'), ctrl.getShift);
router.post('/', authorize('shift:write'), shiftRules, validate, ctrl.createShift);
router.put('/:id', authorize('shift:write'), shiftRules, validate, ctrl.updateShift);
router.delete('/:id', authorize('shift:write'), ctrl.deleteShift);
router.post('/:id/assign', authorize('shift:write'), ctrl.assignShift);

export default router;
