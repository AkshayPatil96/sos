import { UserRole, ChangeRequestField } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  SuperAdminProfile,
  AdminProfile,
  StaffProfile,
  StudentProfile,
  ProfileChangeRequest,
} from '@/generated/prisma/client';
import type { UpdateProfileDTO } from './profile.types';

// ── Contract ──────────────────────────────────────────────────────────────────

export interface IProfileRepository {
  findUserById(
    userId: string,
  ): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isEmailVerified: boolean;
    isProfileComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  findProfileByUserId(
    userId: string,
    role: UserRole,
  ): Promise<SuperAdminProfile | AdminProfile | StaffProfile | StudentProfile | null>;
  updateEditableFields(userId: string, role: UserRole, data: UpdateProfileDTO): Promise<void>;
  findChangeRequestsByUserId(
    userId: string,
    opts?: { page: number; pageSize: number; status?: 'PENDING' | 'APPROVED' | 'REJECTED' },
  ): Promise<{ items: ProfileChangeRequest[]; total: number }>;
  createChangeRequest(data: {
    userId: string;
    field: ChangeRequestField;
    oldValue: string;
    newValue: string;
    reason?: string;
  }): Promise<ProfileChangeRequest>;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class ProfileRepository implements IProfileRepository {
  async findUserById(
    userId: string,
  ): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isEmailVerified: boolean;
    isProfileComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        isProfileComplete: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findProfileByUserId(
    userId: string,
    role: UserRole,
  ): Promise<SuperAdminProfile | AdminProfile | StaffProfile | StudentProfile | null> {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return prisma.superAdminProfile.findUnique({ where: { userId } });
      case UserRole.ADMIN:
        return prisma.adminProfile.findUnique({ where: { userId } });
      case UserRole.STAFF:
        return prisma.staffProfile.findUnique({ where: { userId } });
      case UserRole.STUDENT:
        return prisma.studentProfile.findUnique({ where: { userId } });
      default:
        return null;
    }
  }

  async updateEditableFields(
    userId: string,
    role: UserRole,
    data: UpdateProfileDTO,
  ): Promise<void> {
    const d = data as Record<string, unknown>;
    // Remove undefined keys so we don't overwrite with undefined
    const fields = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));

    if (Object.keys(fields).length === 0) return;

    switch (role) {
      case UserRole.SUPER_ADMIN:
        await prisma.superAdminProfile.upsert({
          where: { userId },
          update: fields,
          create: { userId, ...fields },
        });
        break;
      case UserRole.ADMIN:
        await prisma.adminProfile.upsert({
          where: { userId },
          update: fields,
          create: { userId, ...fields },
        });
        break;
      case UserRole.STAFF:
        await prisma.staffProfile.upsert({
          where: { userId },
          update: fields,
          create: { userId, ...fields },
        });
        break;
      case UserRole.STUDENT:
        await prisma.studentProfile.upsert({
          where: { userId },
          update: fields,
          create: { userId, ...fields },
        });
        break;
    }
  }

  async findChangeRequestsByUserId(
    userId: string,
    opts?: { page: number; pageSize: number; status?: 'PENDING' | 'APPROVED' | 'REJECTED' },
  ): Promise<{ items: ProfileChangeRequest[]; total: number }> {
    const where = { userId, ...(opts?.status ? { status: opts.status } : {}) };
    const [items, total] = await Promise.all([
      prisma.profileChangeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts?.page ?? 1 - 1) * (opts?.pageSize ?? 10),
        take: opts?.pageSize ?? 10,
      }),
      prisma.profileChangeRequest.count({ where }),
    ]);
    return { items, total };
  }

  async createChangeRequest(data: {
    userId: string;
    field: ChangeRequestField;
    oldValue: string;
    newValue: string;
    reason?: string;
  }): Promise<ProfileChangeRequest> {
    return prisma.profileChangeRequest.create({ data });
  }
}

export const profileRepository = new ProfileRepository();
