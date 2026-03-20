import { UserRole } from '@/generated/prisma/client';
import type {
  SuperAdminProfile,
  AdminProfile,
  StaffProfile,
  StudentProfile,
  User,
  ProfileChangeRequest,
} from '@/generated/prisma/client';
import type { ProfileResponseDTO, ChangeRequestResponseDTO } from './profile.types';

function baseProfile(
  user: User,
): Pick<
  ProfileResponseDTO,
  | 'userId'
  | 'role'
  | 'name'
  | 'email'
  | 'isEmailVerified'
  | 'isProfileComplete'
  | 'createdAt'
  | 'updatedAt'
> {
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    isProfileComplete: user.isProfileComplete,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toProfileDTO(
  user: User,
  profile: SuperAdminProfile | AdminProfile | StaffProfile | StudentProfile | null,
): ProfileResponseDTO {
  const base = baseProfile(user);

  if (!profile) return base;

  switch (user.role) {
    case UserRole.SUPER_ADMIN:
      return {
        ...base,
        phone: (profile as SuperAdminProfile).phone,
        profilePhotoKey: (profile as SuperAdminProfile).profilePhotoKey,
      };

    case UserRole.ADMIN:
      return {
        ...base,
        phone: (profile as AdminProfile).phone,
        alternatePhone: (profile as AdminProfile).alternatePhone,
        address: (profile as AdminProfile).address,
        city: (profile as AdminProfile).city,
        state: (profile as AdminProfile).state,
        profilePhotoKey: (profile as AdminProfile).profilePhotoKey,
        emergencyContact: (profile as AdminProfile).emergencyContact as Record<
          string,
          unknown
        > | null,
        department: (profile as AdminProfile).department,
        employeeId: (profile as AdminProfile).employeeId,
        joiningDate: (profile as AdminProfile).joiningDate?.toISOString() ?? null,
      };

    case UserRole.STAFF:
      return {
        ...base,
        phone: (profile as StaffProfile).phone,
        alternatePhone: (profile as StaffProfile).alternatePhone,
        address: (profile as StaffProfile).address,
        city: (profile as StaffProfile).city,
        state: (profile as StaffProfile).state,
        pincode: (profile as StaffProfile).pincode,
        profilePhotoKey: (profile as StaffProfile).profilePhotoKey,
        bio: (profile as StaffProfile).bio,
        emergencyContact: (profile as StaffProfile).emergencyContact as Record<
          string,
          unknown
        > | null,
        department: (profile as StaffProfile).department,
        designation: (profile as StaffProfile).designation,
        employeeId: (profile as StaffProfile).employeeId,
        joiningDate: (profile as StaffProfile).joiningDate?.toISOString() ?? null,
        reportingTo: (profile as StaffProfile).reportingTo,
      };

    case UserRole.STUDENT:
      return {
        ...base,
        phone: (profile as StudentProfile).phone,
        alternatePhone: (profile as StudentProfile).alternatePhone,
        address: (profile as StudentProfile).address,
        city: (profile as StudentProfile).city,
        state: (profile as StudentProfile).state,
        pincode: (profile as StudentProfile).pincode,
        profilePhotoKey: (profile as StudentProfile).profilePhotoKey,
        emergencyContact: (profile as StudentProfile).emergencyContact as Record<
          string,
          unknown
        > | null,
        guardianName: (profile as StudentProfile).guardianName,
        guardianPhone: (profile as StudentProfile).guardianPhone,
        guardianRelation: (profile as StudentProfile).guardianRelation,
        department: (profile as StudentProfile).department,
        course: (profile as StudentProfile).course,
        batch: (profile as StudentProfile).batch,
        enrollmentNumber: (profile as StudentProfile).enrollmentNumber,
        admissionDate: (profile as StudentProfile).admissionDate?.toISOString() ?? null,
        academicYear: (profile as StudentProfile).academicYear,
        section: (profile as StudentProfile).section,
        dateOfBirth: (profile as StudentProfile).dateOfBirth?.toISOString() ?? null,
      };

    default:
      return base;
  }
}

export function toChangeRequestDTO(cr: ProfileChangeRequest): ChangeRequestResponseDTO {
  return {
    id: cr.id,
    field: cr.field,
    oldValue: cr.oldValue,
    newValue: cr.newValue,
    reason: cr.reason,
    status: cr.status as ChangeRequestResponseDTO['status'],
    reviewedBy: cr.reviewedBy,
    reviewedAt: cr.reviewedAt?.toISOString() ?? null,
    reviewNote: cr.reviewNote,
    createdAt: cr.createdAt.toISOString(),
    updatedAt: cr.updatedAt.toISOString(),
  };
}
