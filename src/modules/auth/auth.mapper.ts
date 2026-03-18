import type { User } from '@/generated/prisma/client';
import type { AuthUserDTO } from './auth.types';

/**
 * Maps a raw Prisma User row to the safe public AuthUserDTO.
 * Never exposes: password, failedLoginCount, lockedAt, deletedAt, createdById.
 */
export const AuthMapper = {
  toUserDTO(user: User): AuthUserDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isProfileComplete: user.isProfileComplete,
    };
  },
};
