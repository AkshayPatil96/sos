import type {
  User,
  AuditLog,
  ProfileChangeRequest,
  UserRole,
  UserStatus,
  ChangeRequestStatus,
  ChangeRequestField,
  AuditSeverity,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

// Prisma transaction client type
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Composite types returned from DB ─────────────────────────────────────────

export type UserWithProfiles = User & {
  adminProfile: {
    department: string | null;
    employeeId: string | null;
    joiningDate: Date | null;
  } | null;
  staffProfile: {
    department: string | null;
    designation: string | null;
    employeeId: string | null;
    joiningDate: Date | null;
    reportingTo: string | null;
  } | null;
  studentProfile: {
    course: string | null;
    batch: string | null;
    enrollmentNumber: string | null;
    admissionDate: Date | null;
    academicYear: string | null;
    section: string | null;
    department: string | null;
  } | null;
};

export type PaginatedUsers = { users: User[]; total: number };
export type PaginatedAuditLogs = { logs: AuditLog[]; total: number };
export type PaginatedProfileChanges = { requests: ProfileChangeRequest[]; total: number };

// ── Filter shapes ─────────────────────────────────────────────────────────────

export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  skip: number;
  take: number;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entity?: string;
  severity?: AuditSeverity;
  skip: number;
  take: number;
}

export interface ProfileChangeFilters {
  userId?: string;
  status?: ChangeRequestStatus;
  field?: ChangeRequestField;
  skip: number;
  take: number;
}

// ── Contract ──────────────────────────────────────────────────────────────────

export interface IAdminRepository {
  createUser(data: {
    name: string;
    email: string;
    role: UserRole;
    createdById: string;
  }): Promise<User>;

  findUserById(id: string): Promise<UserWithProfiles | null>;
  findUsers(filters: UserFilters): Promise<PaginatedUsers>;

  updateUserStatus(id: string, status: UserStatus, tx?: PrismaTransactionClient): Promise<void>;

  updateUserRole(id: string, role: UserRole, tx?: PrismaTransactionClient): Promise<void>;

  updateUserEmail(id: string, email: string, tx?: PrismaTransactionClient): Promise<void>;

  upsertAdminProfile(
    userId: string,
    data: {
      department?: string;
      employeeId?: string;
      joiningDate?: Date;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  upsertStaffProfile(
    userId: string,
    data: {
      department?: string;
      designation?: string;
      employeeId?: string;
      joiningDate?: Date;
      reportingTo?: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  upsertStudentProfile(
    userId: string,
    data: {
      course?: string;
      batch?: string;
      enrollmentNumber?: string;
      admissionDate?: Date;
      academicYear?: string;
      section?: string;
      department?: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  deleteAllRefreshTokens(userId: string, tx?: PrismaTransactionClient): Promise<void>;

  findAuditLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs>;

  findProfileChangeRequests(filters: ProfileChangeFilters): Promise<PaginatedProfileChanges>;

  findProfileChangeRequestById(id: string): Promise<ProfileChangeRequest | null>;

  updateProfileChangeStatus(
    id: string,
    status: ChangeRequestStatus,
    reviewedBy: string,
    reviewNote?: string,
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  applyNameChange(userId: string, newValue: string, tx?: PrismaTransactionClient): Promise<void>;

  applyEmailChange(userId: string, newValue: string, tx?: PrismaTransactionClient): Promise<void>;

  applyStudentProfileFieldChange(
    userId: string,
    field: 'enrollmentNumber' | 'dateOfBirth',
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  applyAdminProfileFieldChange(
    userId: string,
    field: 'employeeId',
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  applyStaffProfileFieldChange(
    userId: string,
    field: 'employeeId',
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void>;

  createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;

  createEmailVerificationToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void>;
  deleteEmailVerificationTokensForUser(userId: string, tx?: PrismaTransactionClient): Promise<void>;
  findUserByEmail(email: string): Promise<User | null>;
}

// ── Implementation ────────────────────────────────────────────────────────────

const USER_PROFILE_INCLUDE = {
  adminProfile: {
    select: { department: true, employeeId: true, joiningDate: true },
  },
  staffProfile: {
    select: {
      department: true,
      designation: true,
      employeeId: true,
      joiningDate: true,
      reportingTo: true,
    },
  },
  studentProfile: {
    select: {
      course: true,
      batch: true,
      enrollmentNumber: true,
      admissionDate: true,
      academicYear: true,
      section: true,
      department: true,
    },
  },
} as const;

export class AdminRepository implements IAdminRepository {
  async createUser(data: {
    name: string;
    email: string;
    role: UserRole;
    createdById: string;
  }): Promise<User> {
    return prisma.user.create({ data });
  }

  async findUserById(id: string): Promise<UserWithProfiles | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: USER_PROFILE_INCLUDE,
    });
  }

  async findUsers(filters: UserFilters): Promise<PaginatedUsers> {
    const where = {
      deletedAt: null,
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { email: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async updateUserStatus(
    id: string,
    status: UserStatus,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({ where: { id }, data: { status } });
  }

  async updateUserRole(id: string, role: UserRole, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({ where: { id }, data: { role } });
  }

  async updateUserEmail(id: string, email: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({
      where: { id },
      data: { email, isEmailVerified: false, emailVerifiedAt: null },
    });
  }

  async upsertAdminProfile(
    userId: string,
    data: { department?: string; employeeId?: string; joiningDate?: Date },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.adminProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async upsertStaffProfile(
    userId: string,
    data: {
      department?: string;
      designation?: string;
      employeeId?: string;
      joiningDate?: Date;
      reportingTo?: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.staffProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async upsertStudentProfile(
    userId: string,
    data: {
      course?: string;
      batch?: string;
      enrollmentNumber?: string;
      admissionDate?: Date;
      academicYear?: string;
      section?: string;
      department?: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.studentProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async deleteAllRefreshTokens(userId: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.refreshToken.deleteMany({ where: { userId } });
  }

  async findAuditLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs> {
    const where = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action
        ? { action: { contains: filters.action, mode: 'insensitive' as const } }
        : {}),
      ...(filters.entity
        ? { entity: { contains: filters.entity, mode: 'insensitive' as const } }
        : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findProfileChangeRequests(filters: ProfileChangeFilters): Promise<PaginatedProfileChanges> {
    const where = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.field ? { field: filters.field } : {}),
    };

    const [requests, total] = await prisma.$transaction([
      prisma.profileChangeRequest.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.profileChangeRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async findProfileChangeRequestById(id: string): Promise<ProfileChangeRequest | null> {
    return await prisma.profileChangeRequest.findUnique({ where: { id } });
  }

  async updateProfileChangeStatus(
    id: string,
    status: ChangeRequestStatus,
    reviewedBy: string,
    reviewNote?: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.profileChangeRequest.update({
      where: { id },
      data: { status, reviewedBy, reviewedAt: new Date(), reviewNote: reviewNote ?? null },
    });
  }

  async applyNameChange(
    userId: string,
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({ where: { id: userId }, data: { name: newValue } });
  }

  async applyEmailChange(
    userId: string,
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.user.update({
      where: { id: userId },
      data: { email: newValue, isEmailVerified: false, emailVerifiedAt: null },
    });
  }

  async applyStudentProfileFieldChange(
    userId: string,
    field: 'enrollmentNumber' | 'dateOfBirth',
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    const data =
      field === 'dateOfBirth'
        ? { dateOfBirth: new Date(newValue) }
        : { enrollmentNumber: newValue };
    await db.studentProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async applyAdminProfileFieldChange(
    userId: string,
    field: 'employeeId',
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.adminProfile.upsert({
      where: { userId },
      update: { [field]: newValue },
      create: { userId, [field]: newValue },
    });
  }

  async applyStaffProfileFieldChange(
    userId: string,
    field: 'employeeId',
    newValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.staffProfile.upsert({
      where: { userId },
      update: { [field]: newValue },
      create: { userId, [field]: newValue },
    });
  }

  async createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.passwordResetToken.create({ data });
  }

  async createEmailVerificationToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.emailVerificationToken.create({ data });
  }

  async deleteEmailVerificationTokensForUser(
    userId: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const db = tx ?? prisma;
    await db.emailVerificationToken.deleteMany({ where: { userId } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  }
}

export const adminRepository = new AdminRepository();
