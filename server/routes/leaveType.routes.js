import { Router } from 'express';
import * as ctrl from '../controllers/leaveType.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { leaveTypeRules } from '../middleware/validators/leave.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('leavetype:read'), ctrl.listTypes);
router.get('/:id', authorize('leavetype:read'), ctrl.getType);
router.post('/', authorize('leavetype:write'), leaveTypeRules, validate, ctrl.createType);
router.put('/:id', authorize('leavetype:write'), leaveTypeRules, validate, ctrl.updateType);
router.delete('/:id', authorize('leavetype:write'), ctrl.deleteType);

export default router;
