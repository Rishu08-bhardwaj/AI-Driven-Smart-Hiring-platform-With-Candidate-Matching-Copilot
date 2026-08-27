import { Router } from 'express';
import * as ctrl from '../controllers/company.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { companyRules } from '../middleware/validators/company.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('company:read'), ctrl.getCompany);
router.put('/', authorize('company:update'), companyRules, validate, ctrl.updateCompany);

export default router;
