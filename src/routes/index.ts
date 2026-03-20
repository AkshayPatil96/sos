import { Router, type IRouter } from 'express';
import { authRouter } from '@/modules/auth/auth.routes';
import { adminRouter } from '@/modules/admin/admin.routes';
import { profileRouter } from '@/modules/profile/profile.routes';

const router: IRouter = Router();

/**
 * @swagger
 * components:
 *   responses:
 *     NotFound:
 *       description: The requested route does not exist
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     Unauthorized:
 *       description: Authentication required
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     Forbidden:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 */

router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/profile', profileRouter);

export { router as apiRouter };
