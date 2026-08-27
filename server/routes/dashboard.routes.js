import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();
router.use(authenticate);

router.get('/stats', authorize('dashboard:read'), ctrl.stats);
router.get('/charts', authorize('dashboard:read'), ctrl.charts);
router.get('/widgets', authorize('dashboard:read'), ctrl.widgets);

export default router;
