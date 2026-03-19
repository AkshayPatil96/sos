import type { UserRole } from '@/generated/prisma/client';

// ── Input types (service layer) ───────────────────────────────────────────────

export interface SignInInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface SetPasswordInput {
  token: string;
  password: string;
}

// ── Request meta (passed from controller to service) ─────────────────────────

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

// ── Response DTOs (what the API returns) ─────────────────────────────────────

export interface AuthUserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
}

export interface SignInResponseDTO {
  user: AuthUserDTO;
  accessToken: string;
}

export interface RefreshResponseDTO {
  accessToken: string;
}

export interface VerifyEmailResponseDTO {
  message: string;
  /** Present in development mode only — do not log or share */
  setupToken?: string;
  /** Present in development mode only — URL for testing without email */
  setupUrl?: string;
}
