import type { Request, Response } from 'express';
import { config } from '@/shared/config';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { sendSuccess, sendNoContent } from '@/shared/utils/response';
import { verifyAccessToken } from '@/shared/utils/jwt';
import { Errors } from '@/shared/utils/AppError';
import {
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  setPasswordSchema,
} from './auth.validator';
import { AuthService } from './auth.service';
import { authRepository } from './auth.repository';
import { emailService } from '@/lib/email';

const authService = new AuthService(authRepository, emailService);

/** 7 days in milliseconds — mirrors JWT_REFRESH_EXPIRES_IN */
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const, // 'strict' can cause issues with some clients; 'lax' is a good balance
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const, // 'strict' can cause issues with some clients; 'lax' is a good balance
    path: '/',
  });
}

function getMeta(req: Request): { ip: string; userAgent: string } {
  return {
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/signin:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in successfully. Refresh token set in httpOnly cookie.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const signIn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = signInSchema.parse(req.body);
  const result = await authService.signIn(input, getMeta(req));
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(
    res,
    { user: result.user, accessToken: result.accessToken },
    'Signed in successfully',
  );
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using the httpOnly refresh token cookie
 *     responses:
 *       200:
 *         description: New access token issued. Refresh token rotated in cookie.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawToken = req.cookies?.refreshToken as string | undefined;
  if (!rawToken) {
    throw Errors.unauthorized('No refresh token provided');
  }
  const result = await authService.refreshTokens(rawToken);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { accessToken: result.accessToken }, 'Token refreshed');
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and invalidate the current session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // req.user is guaranteed by requireAuth middleware
  const { id, jti } = req.user!;

  // Decode exp from the access token to compute blacklist TTL
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  await authService.logout(id, jti, payload.exp, getMeta(req));
  clearRefreshCookie(res);
  sendNoContent(res);
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: If the email exists, a reset link has been sent
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email, getMeta(req));
  sendSuccess(res, null, 'If that email exists, a password reset link has been sent');
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using the token from the reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(input, getMeta(req));
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Password has been reset successfully');
});

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change password for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed. All sessions terminated.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = changePasswordSchema.parse(req.body);
  const { id, jti } = req.user!;
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  await authService.changePassword(id, jti, payload.exp, input, getMeta(req));
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Password changed. Please sign in again.');
});

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email address and receive a setup token for password creation
 *     description: |
 *       Validates the email verification token. On success, returns a short-lived
 *       setup token that must be used to set the account password within 1 hour.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified — use setupToken to set password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 setupToken:
 *                   type: string
 *                   description: One-time token valid for 1 hour — send to POST /auth/set-password
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = verifyEmailSchema.parse(req.query);
  const { setupToken } = await authService.verifyEmail(token, getMeta(req));
  sendSuccess(res, { setupToken }, 'Email verified. Use the setup token to set your password.');
});

/**
 * @swagger
 * /auth/set-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set initial password using a setup token
 *     description: |
 *       Consumes the setup token returned by GET /auth/verify-email.
 *       The token is valid for 1 hour and single-use. Password must meet
 *       strength requirements: 8+ chars, 1 upper, 1 lower, 1 digit, 1 special char.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: The setupToken from the verify-email response
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password set successfully — user can now sign in
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
export const setPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = setPasswordSchema.parse(req.body);
  const user = await authService.setPassword(input, getMeta(req));
  sendSuccess(res, { user }, 'Password set. Your account is now active.');
});
