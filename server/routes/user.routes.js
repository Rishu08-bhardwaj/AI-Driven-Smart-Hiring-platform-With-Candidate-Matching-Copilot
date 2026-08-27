import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createUserRules, updateUserRules, passwordRules } from '../middleware/validators/user.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('user:read'), ctrl.listUsers);
router.get('/:id', authorize('user:read'), ctrl.getUser);
router.post('/', authorize('user:create'), createUserRules, validate, ctrl.createUser);
router.put('/:id', authorize('user:update'), updateUserRules, validate, ctrl.updateUser);
router.patch('/:id/password', authorize('user:update'), passwordRules, validate, ctrl.setUserPassword);
router.delete('/:id', authorize('user:delete'), ctrl.deleteUser);

export default router;
