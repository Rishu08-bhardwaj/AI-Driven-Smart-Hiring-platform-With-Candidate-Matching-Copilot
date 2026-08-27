import { Router } from 'express';
import * as ctrl from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  markAttendanceRules,
  bulkAttendanceRules,
  correctionRules,
} from '../middleware/validators/attendance.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('attendance:read'), ctrl.listAttendance);
router.get('/summary', authorize('attendance:read'), ctrl.summary);
router.get('/analytics', authorize('attendance:read'), ctrl.analytics);
router.get('/:id', authorize('attendance:read'), ctrl.getAttendance);

router.post('/', authorize('attendance:write'), markAttendanceRules, validate, ctrl.markAttendance);
router.post('/bulk', authorize('attendance:write'), bulkAttendanceRules, validate, ctrl.bulkAttendance);
router.put('/:id', authorize('attendance:write'), correctionRules, validate, ctrl.correctAttendance);
router.delete('/:id', authorize('attendance:write'), ctrl.deleteAttendance);

export default router;
