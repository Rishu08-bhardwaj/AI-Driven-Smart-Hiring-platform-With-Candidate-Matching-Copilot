import { Router } from 'express';
import * as ctrl from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('audit:read'), ctrl.listAuditLogs);
router.get('/actions', authorize('audit:read'), ctrl.listActions);

export default router;
