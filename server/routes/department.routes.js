import { Router } from 'express';
import * as ctrl from '../controllers/department.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { departmentRules } from '../middleware/validators/department.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('department:read'), ctrl.listDepartments);
router.get('/:id', authorize('department:read'), ctrl.getDepartment);
router.post('/', authorize('department:create'), departmentRules, validate, ctrl.createDepartment);
router.put('/:id', authorize('department:update'), departmentRules, validate, ctrl.updateDepartment);
router.delete('/:id', authorize('department:delete'), ctrl.deleteDepartment);
router.patch('/:id/archive', authorize('department:update'), ctrl.archiveDepartment);
router.patch('/:id/restore', authorize('department:update'), ctrl.restoreDepartment);

export default router;
