import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';
import { UserStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import type { IEmailService } from '@/lib/email';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRemainingTtl,
} from '@/shared/utils/jwt';
import { generateSecureToken, hashToken } from '@/shared/utils/token';
import { writeAuditLog } from '@/shared/utils/auditLog';
import { Errors } from '@/shared/utils/AppError';
import { config } from '@/shared/config';
import { AuthMapper } from './auth.mapper';
import type { IAuthRepository } from './auth.repository';
import type {
  SignInInput,
  ResetPasswordInput,
  ChangePasswordInput,
  SetPasswordInput,
  RequestMeta,
  SignInResponseDTO,
  RefreshResponseDTO,
  AuthUserDTO,
} from './auth.types';

/** Lock window in minutes — matched in service and displayed in error message */
const LOCK_WINDOW_MINUTES = 30;
/** Max consecutive failures before account is locked */
const MAX_FAILED_ATTEMPTS = 10;
/** bcrypt rounds for password hashing */
const BCRYPT_ROUNDS = 12;
/** bcrypt rounds for refresh token hashing (lower — token has its own entropy) */
const REFRESH_TOKEN_BCRYPT_ROUNDS = 10;
/** Refresh token TTL parsed from config (e.g. "7d" → 604800000 ms) */
const REFRESH_TOKEN_TTL_MS = ms(config.JWT_REFRESH_EXPIRES_IN as Parameters<typeof ms>[0]);

export class AuthService {
  constructor(
    private readonly repo: IAuthRepository,
    private readonly emailSvc: IEmailService,
  ) {}

  /**
   * Signs in a user: validates credentials, enforces lock policy, issues token pair.
   */
  async signIn(
    input: SignInInput,
    meta: RequestMeta,
  ): Promise<SignInResponseDTO & { refreshToken: string }> {
    const user = await this.repo.findUserByEmail(input.email);
    console.log('user: ', user);

    // Always run bcrypt compare to prevent timing attacks, even if user not found
    const dummyHash = '$2a$12$invalidhashfortimingnormalization000000000000000000000000';
    const passwordToCompare = user?.password ?? dummyHash;

    if (!user) {
      await bcrypt.compare(input.password, passwordToCompare);
      throw Errors.unauthorized('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw Errors.unauthorized('Email address is not verified');
    }

    // Check account status
    if (user.status !== UserStatus.ACTIVE) {
      throw Errors.unauthorized('Your account has been deactivated. Contact support.');
    }

    // Check account lock (30-min rolling window)
    if (user.lockedAt) {
      const lockExpiry = new Date(user.lockedAt.getTime() + LOCK_WINDOW_MINUTES * 60 * 1000);
      if (new Date() < lockExpiry) {
        throw Errors.unauthorized(
          `Account is temporarily locked. Try again after ${lockExpiry.toISOString()}.`,
        );
      }
      // Lock window expired — allow attempt (will reset on success)
    }

    const passwordMatch = await bcrypt.compare(input.password, passwordToCompare);

    if (!passwordMatch) {
      const newCount = (user.failedLoginCount ?? 0) + 1;
      const lockAt = newCount >= MAX_FAILED_ATTEMPTS ? new Date() : undefined;
      await this.repo.updateUserLoginFailure(user.id, newCount, lockAt);

      void writeAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: 'AUTH_SIGN_IN_FAILURE',
        entity: 'User',
        entityId: user.id,
        severity: 'medium',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });

      if (lockAt) {
        throw Errors.unauthorized(
          `Too many failed attempts. Account locked for ${LOCK_WINDOW_MINUTES} minutes.`,
        );
      }
      throw Errors.unauthorized('Invalid email or password');
    }

    // Success — reset failure count, update lastLoginAt
    await this.repo.updateUserLoginSuccess(user.id);

    const jti = uuidv4();
    const accessToken = signAccessToken({ sub: user.id, role: user.role, jti });
    const rawRefreshToken = signRefreshToken({ sub: user.id, jti: uuidv4() });
    const refreshHash = await bcrypt.hash(rawRefreshToken, REFRESH_TOKEN_BCRYPT_ROUNDS);

    // Store hashed refresh token — expiry mirrors JWT_REFRESH_EXPIRES_IN
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.repo.createRefreshToken({
      jti,
      userId: user.id,
      hash: refreshHash,
      expiresAt: refreshExpiry,
    });

    void writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'AUTH_SIGN_IN',
      entity: 'User',
      entityId: user.id,
      severity: 'low',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: AuthMapper.toUserDTO(user),
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Rotates the refresh token: verifies the old one, issues a new pair.
   */
  async refreshTokens(
    rawRefreshToken: string,
  ): Promise<RefreshResponseDTO & { refreshToken: string }> {
    const payload = verifyRefreshToken(rawRefreshToken);
    console.log('payload: ', payload);

    const stored = await this.repo.findRefreshTokenByJti(payload.jti);
    console.log('stored : ', stored);
    if (!stored) {
      throw Errors.unauthorized('Refresh token not found or already rotated');
    }

    if (stored.expiresAt < new Date()) {
      await this.repo.deleteRefreshTokenByJti(payload.jti);
      throw Errors.unauthorized('Refresh token has expired');
    }

    const tokenMatch = await bcrypt.compare(rawRefreshToken, stored.hash);
    if (!tokenMatch) {
      // Potential token theft — delete the stored token and force re-login
      await this.repo.deleteRefreshTokenByJti(payload.jti);
      throw Errors.unauthorized('Refresh token is invalid');
    }

    const user = await this.repo.findUserById(stored.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw Errors.unauthorized('User account is not active');
    }

    // Rotate: delete old, issue new
    await this.repo.deleteRefreshTokenByJti(payload.jti);

    const newJti = uuidv4();
    const accessToken = signAccessToken({ sub: user.id, role: user.role, jti: newJti });
    const newRawRefreshToken = signRefreshToken({ sub: user.id, jti: uuidv4() });
    const newHash = await bcrypt.hash(newRawRefreshToken, REFRESH_TOKEN_BCRYPT_ROUNDS);
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.repo.createRefreshToken({
      jti: newJti,
      userId: user.id,
      hash: newHash,
      expiresAt: refreshExpiry,
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  }

  /**
   * Logs out: deletes the refresh token and blacklists the access token JTI.
   */
  async logout(
    userId: string,
    accessJti: string,
    accessExp: number,
    meta: RequestMeta,
  ): Promise<void> {
    // Remove refresh token from DB
    await this.repo.deleteRefreshTokenByJti(accessJti);

    // Blacklist the access token until it naturally expires
    const ttl = getRemainingTtl(accessExp);
    if (ttl > 0) {
      await cache.set(`auth:blacklist:${accessJti}`, true, ttl);
    }

    void writeAuditLog({
      userId,
      action: 'AUTH_LOGOUT',
      entity: 'User',
      entityId: userId,
      severity: 'low',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Sends a password reset email.
   * Always returns void regardless of whether the email exists — prevents enumeration.
   */
  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.repo.findUserByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      // Return silently — never leak whether the email exists
      return;
    }

    // Invalidate any existing reset tokens before issuing a new one
    await this.repo.deletePasswordResetTokensForUser(user.id);

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.PASSWORD_RESET_EXPIRES_MIN * 60 * 1000);

    const resetUrl = `${config.FRONTEND_URL}/auth/reset-password?token=${rawToken}`;

    try {
      await this.emailSvc.sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch {
      // If email fails, do not leave a usable reset token in the DB
      void writeAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: 'AUTH_FORGOT_PASSWORD_FAILED',
        entity: 'User',
        entityId: user.id,
        severity: 'high',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw Errors.serviceUnavailable('Unable to send email. Please try again later.');
    }

    // Email sent successfully — now store the token
    await this.repo.createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

    void writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'AUTH_FORGOT_PASSWORD',
      entity: 'User',
      entityId: user.id,
      severity: 'low',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Resets password using a valid reset token. Atomically updates password,
   * marks token used, and deletes all existing sessions.
   */
  async resetPassword(input: ResetPasswordInput, meta: RequestMeta): Promise<void> {
    const tokenHash = hashToken(input.token);
    const resetToken = await this.repo.findPasswordResetToken(tokenHash);

    if (!resetToken) {
      throw Errors.badRequest('Invalid or expired password reset token');
    }

    const user = await this.repo.findUserById(resetToken.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw Errors.badRequest('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await this.repo.updateUserPassword(user.id, passwordHash, tx);
      await this.repo.markPasswordResetTokenUsed(resetToken.id, tx);
      await this.repo.deleteAllRefreshTokensForUser(user.id, tx);
    });

    void writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'AUTH_RESET_PASSWORD',
      entity: 'User',
      entityId: user.id,
      severity: 'medium',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Changes password for an authenticated user. Requires current password.
   * Invalidates all sessions and blacklists the current access token.
   */
  async changePassword(
    userId: string,
    accessJti: string,
    accessExp: number,
    input: ChangePasswordInput,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user || !user.password) {
      throw Errors.badRequest('Cannot change password for this account');
    }

    const matches = await bcrypt.compare(input.currentPassword, user.password);
    if (!matches) {
      throw Errors.badRequest('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await this.repo.updateUserPassword(user.id, passwordHash, tx);
      await this.repo.deleteAllRefreshTokensForUser(user.id, tx);
    });

    // Blacklist the current access token
    const ttl = getRemainingTtl(accessExp);
    if (ttl > 0) {
      await cache.set(`auth:blacklist:${accessJti}`, true, ttl);
    }

    void writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'AUTH_CHANGE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      severity: 'medium',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Verifies a user's email address using a token from the verification email.
   * On success, issues a short-lived PasswordSetupToken (1h) for the user to set their password.
   * In development mode, also returns the raw setup token and URL for testing without email.
   */
  async verifyEmail(
    token: string,
    meta: RequestMeta,
  ): Promise<{
    message: string;
    setupToken?: string;
    setupUrl?: string;
  }> {
    console.log('token: ', token);
    const tokenHash = hashToken(token);
    const verifyToken = await this.repo.findEmailVerificationToken(tokenHash);
    console.log('verifyToken: ', verifyToken);

    if (!verifyToken) {
      throw Errors.badRequest('Invalid verification link');
    }

    const user = await this.repo.findUserById(verifyToken.userId);
    console.log('user: ', user);
    if (!user) {
      throw Errors.badRequest('Invalid verification link');
    }

    if (user.isEmailVerified) {
      await this.repo.deleteEmailVerificationToken(verifyToken.id);
      throw Errors.badRequest('Email is already verified');
    }

    const rawSetupToken = generateSecureToken();
    const setupTokenHash = hashToken(rawSetupToken);
    const setupExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await this.repo.markEmailVerified(user.id, tx);
      await this.repo.deleteEmailVerificationToken(verifyToken.id, tx);
      await this.repo.upsertPasswordSetupToken(
        { userId: user.id, tokenHash: setupTokenHash, expiresAt: setupExpiresAt },
        tx,
      );
    });

    void writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'USER_EMAIL_VERIFIED',
      entity: 'User',
      entityId: user.id,
      severity: 'medium',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const response: { message: string; setupToken?: string; setupUrl?: string } = {
      message: 'Email verified. Use the setup token to set your password.',
    };

    if (config.NODE_ENV === 'development') {
      response.setupToken = rawSetupToken;
      response.setupUrl = `${config.FRONTEND_URL}/auth/set-password?token=${rawSetupToken}`;
    }

    return response;
  }

  /**
   * Sets the initial password for a user who has already verified their email.
   * Consumes a PasswordSetupToken — single use, expires in 1 hour.
   */
  async setPassword(input: SetPasswordInput, meta: RequestMeta): Promise<AuthUserDTO> {
    const tokenHash = hashToken(input.token);
    const setupToken = await this.repo.findPasswordSetupToken(tokenHash);

    if (!setupToken) {
      throw Errors.badRequest('Invalid or already used setup link');
    }

    const user = await this.repo.findUserById(setupToken.userId);
    if (!user) {
      throw Errors.badRequest('Invalid or already used setup link');
    }

    if (user.password !== null) {
      throw Errors.badRequest('Password has already been set for this account');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await this.repo.updateUserPassword(user.id, passwordHash, tx);
      await this.repo.deletePasswordSetupToken(setupToken.id, tx);
    });

    // Re-fetch to get updated isProfileComplete
    const updated = await this.repo.findUserById(user.id);

    void writeAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'USER_PASSWORD_SET',
      entity: 'User',
      entityId: user.id,
      severity: 'medium',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return AuthMapper.toUserDTO(updated ?? user);
  }
}
