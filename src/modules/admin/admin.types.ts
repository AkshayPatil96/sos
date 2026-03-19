import type {
  UserRole,
  UserStatus,
  ChangeRequestStatus,
  ChangeRequestField,
} from '@/generated/prisma/client';

// ── Input Types ───────────────────────────────────────────────────────────────

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserStatusInput {
  status: UserStatus;
}

export interface UpdateUserRoleInput {
  role: UserRole;
}

/** Flat optional object with all admin-controlled profile fields across all role types */
export interface UpdateUserProfileInput {
  // AdminProfile admin-controlled fields
  department?: string;
  employeeId?: string;
  joiningDate?: string; // ISO string — service converts to Date

  // StaffProfile admin-controlled fields
  designation?: string;
  reportingTo?: string; // userId of reporting manager

  // StudentProfile admin-controlled fields
  course?: string;
  batch?: string;
  enrollmentNumber?: string;
  admissionDate?: string; // ISO string — service converts to Date
  academicYear?: string;
  section?: string;
}

export interface ReviewProfileChangeInput {
  reviewNote?: string;
}

export interface ListUsersQuery {
  page?: string;
  limit?: string;
  role?: string;
  status?: string;
  search?: string;
}

export interface ListAuditLogsQuery {
  page?: string;
  limit?: string;
  userId?: string;
  action?: string;
  entity?: string;
  severity?: string;
}

export interface ListProfileChangesQuery {
  page?: string;
  limit?: string;
  status?: string;
  userId?: string;
  field?: string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface UserListItemDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  createdAt: string;
}

export interface AdminProfileDTO {
  department: string | null;
  employeeId: string | null;
  joiningDate: string | null;
}

export interface StaffProfileDTO {
  department: string | null;
  designation: string | null;
  employeeId: string | null;
  joiningDate: string | null;
  reportingTo: string | null;
}

export interface StudentProfileDTO {
  course: string | null;
  batch: string | null;
  enrollmentNumber: string | null;
  admissionDate: string | null;
  academicYear: string | null;
  section: string | null;
  department: string | null;
}

export interface UserDetailDTO extends UserListItemDTO {
  adminProfile: AdminProfileDTO | null;
  staffProfile: StaffProfileDTO | null;
  studentProfile: StudentProfileDTO | null;
  lastLoginAt: string | null;
  createdById: string | null;
}

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  severity: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ProfileChangeRequestDTO {
  id: string;
  userId: string;
  field: ChangeRequestField;
  oldValue: string;
  newValue: string;
  reason: string | null;
  status: ChangeRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}
