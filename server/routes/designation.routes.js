import { Router } from 'express';
import * as ctrl from '../controllers/designation.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { designationRules } from '../middleware/validators/department.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('designation:read'), ctrl.listDesignations);
router.get('/:id', authorize('designation:read'), ctrl.getDesignation);
router.post('/', authorize('designation:create'), designationRules, validate, ctrl.createDesignation);
router.put('/:id', authorize('designation:update'), designationRules, validate, ctrl.updateDesignation);
router.delete('/:id', authorize('designation:delete'), ctrl.deleteDesignation);
router.patch('/:id/archive', authorize('designation:update'), ctrl.archiveDesignation);
router.patch('/:id/restore', authorize('designation:update'), ctrl.restoreDesignation);

export default router;
