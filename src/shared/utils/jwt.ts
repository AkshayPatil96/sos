import jwt from 'jsonwebtoken';
import { config } from '@/shared/config';
import { Errors } from '@/shared/utils/AppError';
import type { UserRole } from '@/generated/prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Signs a short-lived access token (JWT_ACCESS_EXPIRES_IN, default 15m).
 */
export function signAccessToken(payload: { sub: string; role: UserRole; jti: string }): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Signs a long-lived refresh token (JWT_REFRESH_EXPIRES_IN, default 7d).
 */
export function signRefreshToken(payload: { sub: string; jti: string }): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies and decodes an access token.
 * Throws Errors.unauthorized() on expiry or any invalid state.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw Errors.unauthorized('Invalid or expired access token');
  }
}

/**
 * Verifies and decodes a refresh token.
 * Throws Errors.unauthorized() on expiry or any invalid state.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw Errors.unauthorized('Invalid or expired refresh token');
  }
}

/**
 * Returns the remaining TTL in seconds for a JWT payload.
 * Used to set cache TTL for blacklisted JTIs.
 */
export function getRemainingTtl(exp: number): number {
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}
