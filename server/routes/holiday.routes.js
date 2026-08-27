import { Router } from 'express';
import * as ctrl from '../controllers/holiday.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { holidayRules } from '../middleware/validators/leave.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('holiday:read'), ctrl.listHolidays);
router.get('/:id', authorize('holiday:read'), ctrl.getHoliday);
router.post('/', authorize('holiday:write'), holidayRules, validate, ctrl.createHoliday);
router.put('/:id', authorize('holiday:write'), holidayRules, validate, ctrl.updateHoliday);
router.delete('/:id', authorize('holiday:write'), ctrl.deleteHoliday);

export default router;
