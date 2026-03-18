import { Router, type IRouter } from 'express';
import { authRouter } from '@/modules/auth/auth.routes';

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

export { router as apiRouter };
