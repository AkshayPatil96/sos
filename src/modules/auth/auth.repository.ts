import type {
  User,
  RefreshToken,
  PasswordResetToken,
  EmailVerificationToken,
  PasswordSetupToken,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

// Prisma transaction client type
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Contract ──────────────────────────────────────────────────────────────────

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updateUserLoginSuccess(id: string): Promise<void>;
  updateUserLoginFailure(id: string, newFailedCount: number, lockAt?: Date): Promise<void>;
  updateUserPassword(id: string, passwordHash: string, tx?: PrismaTransactionClient): Promise<void>;
  markEmailVerified(id: string, tx?: PrismaTransactionClient): Promise<void>;

  createRefreshToken(data: {
    jti: string;
    userId: string;
    hash: string;
    expiresAt: Date;
  }): Promise<void>;
  findRefreshTokenByJti(jti: string): Promise<RefreshToken | null>;
  deleteRefreshTokenByJti(jti: string): Promise<void>;
  deleteAllRefreshTokensForUser(userId: string, tx?: PrismaTransactionClient): Promise<void>;

  createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null>;
  markPasswordResetTokenUsed(id: string, tx?: PrismaTransactionClient): Promise<void>;
  deletePasswordResetTokensForUser(userId: string): Promise<void>;

  createEmailVerificationToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | null>;
  deleteEmailVerificationToken(id: string, tx?: PrismaTransactionClient): Promise<void>;

  createPasswordSetupToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  upsertPasswordSetupToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void>;
  findPasswordSetupToken(tokenHash: string): Promise<PasswordSetupToken | null>;
  deletePasswordSetupToken(id: string, tx?: PrismaTransactionClient): Promise<void>;
  deletePasswordSetupTokensForUser(userId: string): Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class AuthRepository implements IAuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async updateUserLoginSuccess(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lastLoginAt: new Date(), lockedAt: null },
    });
  }

  async updateUserLoginFailure(id: string, newFailedCount: number, lockAt?: Date): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        failedLoginCount: newFailedCount,
        lockedAt: lockAt ?? null,
      },
    });
  }

  async updateUserPassword(
    id: string,
    passwordHash: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({ where: { id }, data: { password: passwordHash } });
  }

  async markEmailVerified(id: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({
      where: { id },
      data: { isEmailVerified: true, emailVerifiedAt: new Date() },
    });
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────────

  async createRefreshToken(data: {
    jti: string;
    userId: string;
    hash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.refreshToken.create({ data });
  }

  async findRefreshTokenByJti(jti: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { jti } });
  }

  async deleteRefreshTokenByJti(jti: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { jti } });
  }

  async deleteAllRefreshTokensForUser(userId: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.refreshToken.deleteMany({ where: { userId } });
  }

  // ── Password reset tokens ──────────────────────────────────────────────────

  async createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.passwordResetToken.create({ data });
  }

  async findPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
  }

  async markPasswordResetTokenUsed(id: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async deletePasswordResetTokensForUser(userId: string): Promise<void> {
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
  }

  // ── Email verification tokens ──────────────────────────────────────────────

  async createEmailVerificationToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.emailVerificationToken.create({ data });
  }

  async findEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | null> {
    return await prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async deleteEmailVerificationToken(id: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.emailVerificationToken.delete({ where: { id } });
  }

  // ── Password setup tokens ─────────────────────────────────────────────────

  async createPasswordSetupToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.passwordSetupToken.create({ data });
  }

  async upsertPasswordSetupToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.passwordSetupToken.upsert({
      where: { userId: data.userId },
      update: { tokenHash: data.tokenHash, expiresAt: data.expiresAt },
      create: { userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt },
    });
  }

  async findPasswordSetupToken(tokenHash: string): Promise<PasswordSetupToken | null> {
    return await prisma.passwordSetupToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async deletePasswordSetupToken(id: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.passwordSetupToken.delete({ where: { id } });
  }

  async deletePasswordSetupTokensForUser(userId: string): Promise<void> {
    await prisma.passwordSetupToken.deleteMany({ where: { userId } });
  }
}

export const authRepository = new AuthRepository();
