import { UserRole } from '@/generated/prisma/client';
import { Errors } from '@/shared/utils/AppError';
import { writeAuditLog } from '@/shared/utils/auditLog';
import type { IProfileRepository } from './profile.repository';
import type {
  ProfileResponseDTO,
  UpdateProfileDTO,
  CreateChangeRequestDTO,
  PaginatedChangeRequestsDTO,
  ChangeRequestField,
} from './profile.types';
import { toProfileDTO, toChangeRequestDTO } from './profile.mapper';

export class ProfileService {
  constructor(private readonly repo: IProfileRepository) {}

  /**
   * Returns the authenticated user's full profile (user + role-specific profile data).
   */
  async getMyProfile(userId: string): Promise<ProfileResponseDTO> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.notFound('User not found');

    const profile = await this.repo.findProfileByUserId(userId, user.role);
    return toProfileDTO(user as Parameters<typeof toProfileDTO>[0], profile);
  }

  /**
   * Updates user-editable fields for the authenticated user's profile.
   * Only whitelisted per-role fields are accepted — any non-whitelisted fields are silently ignored.
   */
  async updateMyProfile(
    userId: string,
    input: UpdateProfileDTO,
    meta: { ip: string; userAgent: string },
  ): Promise<ProfileResponseDTO> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.notFound('User not found');

    const allowedFields = getEditableFields(user.role);
    const filtered: UpdateProfileDTO = {};
    for (const key of allowedFields) {
      if (key in input) {
        (filtered as Record<string, unknown>)[key] = (input as Record<string, unknown>)[key];
      }
    }

    await this.repo.updateEditableFields(userId, user.role, filtered);

    void writeAuditLog({
      userId,
      userEmail: user.email,
      action: 'PROFILE_UPDATE',
      entity: 'User',
      entityId: userId,
      severity: 'low',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    // Re-fetch to return updated state
    const updatedUser = await this.repo.findUserById(userId);
    const updatedProfile = await this.repo.findProfileByUserId(userId, user.role);
    return toProfileDTO(updatedUser as Parameters<typeof toProfileDTO>[0], updatedProfile);
  }

  /**
   * Submits a change request for an admin-controlled field.
   * Only allowed fields per role are accepted.
   */
  async requestChange(
    userId: string,
    input: CreateChangeRequestDTO,
    meta: { ip: string; userAgent: string },
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.notFound('User not found');

    const allowedFields = getRequestableFields(user.role);
    if (!allowedFields.includes(input.field)) {
      throw Errors.forbidden(`Field '${input.field}' cannot be requested for your role`);
    }

    // Get current value of the field for oldValue
    const profile = await this.repo.findProfileByUserId(userId, user.role);
    const oldValue = getFieldValue(profile, input.field);

    await this.repo.createChangeRequest({
      userId,
      field: input.field,
      oldValue: oldValue ?? '',
      newValue: input.newValue,
      reason: input.reason,
    });

    void writeAuditLog({
      userId,
      userEmail: user.email,
      action: 'PROFILE_CHANGE_REQUEST',
      entity: 'User',
      entityId: userId,
      severity: 'medium',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Returns paginated change requests for the authenticated user.
   */
  async getMyChangeRequests(
    userId: string,
    opts?: { page: number; pageSize: number; status?: 'PENDING' | 'APPROVED' | 'REJECTED' },
  ): Promise<PaginatedChangeRequestsDTO> {
    const { items, total } = await this.repo.findChangeRequestsByUserId(userId, opts);
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 10;
    return {
      items: items.map(toChangeRequestDTO),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

// ── Field whitelists ──────────────────────────────────────────────────────────

const SUPER_ADMIN_EDITABLE = ['phone', 'profilePhotoKey'] as const;
const ADMIN_EDITABLE = [
  'phone',
  'alternatePhone',
  'address',
  'city',
  'state',
  'profilePhotoKey',
  'emergencyContact',
] as const;
const STAFF_EDITABLE = [
  'phone',
  'alternatePhone',
  'address',
  'city',
  'state',
  'pincode',
  'profilePhotoKey',
  'bio',
  'emergencyContact',
] as const;
const STUDENT_EDITABLE = [
  'phone',
  'alternatePhone',
  'address',
  'city',
  'state',
  'pincode',
  'profilePhotoKey',
  'guardianName',
  'guardianPhone',
  'guardianRelation',
  'emergencyContact',
] as const;

const ADMIN_REQUESTABLE = ['DEPARTMENT', 'EMPLOYEE_ID', 'JOINING_DATE'] as const;
const STAFF_REQUESTABLE = [
  'DEPARTMENT',
  'DESIGNATION',
  'EMPLOYEE_ID',
  'JOINING_DATE',
  'REPORTING_TO',
] as const;
const STUDENT_REQUESTABLE = [
  'DEPARTMENT',
  'COURSE',
  'BATCH',
  'ENROLLMENT_NUMBER',
  'ADMISSION_DATE',
  'ACADEMIC_YEAR',
  'SECTION',
  'DATE_OF_BIRTH',
] as const;

function getEditableFields(role: UserRole): readonly string[] {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return SUPER_ADMIN_EDITABLE;
    case UserRole.ADMIN:
      return ADMIN_EDITABLE;
    case UserRole.STAFF:
      return STAFF_EDITABLE;
    case UserRole.STUDENT:
      return STUDENT_EDITABLE;
    default:
      return [];
  }
}

function getRequestableFields(role: UserRole): readonly string[] {
  switch (role) {
    case UserRole.ADMIN:
      return ADMIN_REQUESTABLE;
    case UserRole.STAFF:
      return STAFF_REQUESTABLE;
    case UserRole.STUDENT:
      return STUDENT_REQUESTABLE;
    default:
      return [];
  }
}

function getFieldValue(
  profile: Record<string, unknown> | null,
  field: ChangeRequestField,
): string | null {
  if (!profile) return null;
  const v = profile[field as keyof typeof profile];
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}
