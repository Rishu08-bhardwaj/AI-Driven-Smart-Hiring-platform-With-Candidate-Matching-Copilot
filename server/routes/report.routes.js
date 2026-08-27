import { Router } from 'express';
import * as ctrl from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();
router.use(authenticate);

router.get('/headcount', authorize('report:read'), ctrl.headcount);
router.get('/attendance', authorize('report:read'), ctrl.attendance);
router.get('/payroll', authorize('report:read'), ctrl.payroll);
router.get('/leave', authorize('report:read'), ctrl.leave);

export default router;
