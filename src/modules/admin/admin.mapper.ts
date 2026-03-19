import type { User, AuditLog, ProfileChangeRequest } from '@/generated/prisma/client';
import type { UserWithProfiles } from './admin.repository';
import type {
  UserListItemDTO,
  UserDetailDTO,
  AdminProfileDTO,
  StaffProfileDTO,
  StudentProfileDTO,
  AuditLogDTO,
  ProfileChangeRequestDTO,
} from './admin.types';

export const AdminMapper = {
  /**
   * Maps a raw User row to the lightweight list item DTO.
   * Excludes password, deletedAt, and all profile data.
   */
  toUserListItemDTO(user: User): UserListItemDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isProfileComplete: user.isProfileComplete,
      createdAt: user.createdAt.toISOString(),
    };
  },

  toUserListItemDTOList(users: User[]): UserListItemDTO[] {
    return users.map((u) => AdminMapper.toUserListItemDTO(u));
  },

  /**
   * Maps a User with loaded profile relations to the detailed DTO.
   * Excludes password, deletedAt, tokens, and fields not visible to admin.
   */
  toUserDetailDTO(user: UserWithProfiles): UserDetailDTO {
    let adminProfile: AdminProfileDTO | null = null;
    let staffProfile: StaffProfileDTO | null = null;
    let studentProfile: StudentProfileDTO | null = null;

    if (user.adminProfile) {
      adminProfile = {
        department: user.adminProfile.department,
        employeeId: user.adminProfile.employeeId,
        joiningDate: user.adminProfile.joiningDate?.toISOString() ?? null,
      };
    }

    if (user.staffProfile) {
      staffProfile = {
        department: user.staffProfile.department,
        designation: user.staffProfile.designation,
        employeeId: user.staffProfile.employeeId,
        joiningDate: user.staffProfile.joiningDate?.toISOString() ?? null,
        reportingTo: user.staffProfile.reportingTo,
      };
    }

    if (user.studentProfile) {
      studentProfile = {
        course: user.studentProfile.course,
        batch: user.studentProfile.batch,
        enrollmentNumber: user.studentProfile.enrollmentNumber,
        admissionDate: user.studentProfile.admissionDate?.toISOString() ?? null,
        academicYear: user.studentProfile.academicYear,
        section: user.studentProfile.section,
        department: user.studentProfile.department,
      };
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isProfileComplete: user.isProfileComplete,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdById: user.createdById,
      adminProfile,
      staffProfile,
      studentProfile,
    };
  },

  /**
   * Maps a single AuditLog row to its DTO.
   */
  toAuditLogDTO(log: AuditLog): AuditLogDTO {
    return {
      id: log.id,
      userId: log.userId,
      userEmail: log.userEmail,
      userRole: log.userRole,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      severity: log.severity,
      before: log.before,
      after: log.after,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    };
  },

  toAuditLogDTOList(logs: AuditLog[]): AuditLogDTO[] {
    return logs.map((l) => AdminMapper.toAuditLogDTO(l));
  },

  /**
   * Maps a ProfileChangeRequest row to its DTO.
   */
  toProfileChangeRequestDTO(request: ProfileChangeRequest): ProfileChangeRequestDTO {
    return {
      id: request.id,
      userId: request.userId,
      field: request.field,
      oldValue: request.oldValue,
      newValue: request.newValue,
      reason: request.reason,
      status: request.status,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      reviewNote: request.reviewNote,
      createdAt: request.createdAt.toISOString(),
    };
  },

  toProfileChangeRequestDTOList(requests: ProfileChangeRequest[]): ProfileChangeRequestDTO[] {
    return requests.map((r) => AdminMapper.toProfileChangeRequestDTO(r));
  },
};
