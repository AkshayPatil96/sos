import { Router, type IRouter } from 'express';
import { requireAuth } from '@/shared/middlewares/auth.middleware';
import {
  strictRateLimiter,
  moderateRateLimiter,
} from '@/shared/middlewares/rateLimiter.middleware';
import * as AuthController from './auth.controller';

const router: IRouter = Router();

/**
 * POST /auth/signin
 * Rate-limited to 5 requests per 15 minutes to mitigate brute-force attacks.
 */
router.post('/signin', strictRateLimiter, AuthController.signIn);

/**
 * POST /auth/refresh
 * Issues a new access token using the httpOnly refresh token cookie.
 * Moderately rate-limited — refresh tokens are short-lived and rotation is tracked.
 */
router.post('/refresh', moderateRateLimiter, AuthController.refresh);

/**
 * POST /auth/logout
 * Requires valid access token. Invalidates the session.
 */
router.post('/logout', requireAuth, AuthController.logout);

/**
 * POST /auth/forgot-password
 * Rate-limited. Always returns 200 — never leaks whether email exists.
 */
router.post('/forgot-password', strictRateLimiter, AuthController.forgotPassword);

/**
 * POST /auth/reset-password
 * Requires a valid reset token from the forgot-password email.
 * Moderately rate-limited to prevent token-guessing attacks.
 */
router.post('/reset-password', moderateRateLimiter, AuthController.resetPassword);

/**
 * PATCH /auth/change-password
 * Requires authentication. Terminates all other sessions on success.
 */
router.patch('/change-password', requireAuth, AuthController.changePassword);

/**
 * GET /auth/verify-email?token=
 * Verifies the email address using the token from the verification email.
 */
router.get('/verify-email', AuthController.verifyEmail);

/**
 * POST /auth/set-password
 * Sets the initial password for an invited or self-registered user.
 */
router.post('/set-password', AuthController.setPassword);

export { router as authRouter };
