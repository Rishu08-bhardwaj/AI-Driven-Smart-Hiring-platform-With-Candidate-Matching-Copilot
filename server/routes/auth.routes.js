import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { loginRules, forgotRules, resetRules } from '../middleware/validators/auth.validators.js';

const router = Router();

router.post('/login', authLimiter, loginRules, validate, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post('/forgot-password', authLimiter, forgotRules, validate, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, resetRules, validate, ctrl.resetPassword);

export default router;
