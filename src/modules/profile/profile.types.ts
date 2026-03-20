import { UserRole, ChangeRequestField } from '@/generated/prisma/client';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ProfileResponseDTO {
  userId: string;
  role: UserRole;
  // Common fields
  name: string;
  email: string;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  createdAt: string;
  updatedAt: string;
  // Role-specific fields (all optional — not all roles have all fields)
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  profilePhotoKey?: string | null;
  bio?: string | null;
  emergencyContact?: Record<string, unknown> | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelation?: string | null;
  department?: string | null;
  course?: string | null;
  batch?: string | null;
  enrollmentNumber?: string | null;
  admissionDate?: string | null;
  academicYear?: string | null;
  section?: string | null;
  dateOfBirth?: string | null;
  designation?: string | null;
  employeeId?: string | null;
  joiningDate?: string | null;
  reportingTo?: string | null;
}

export interface UpdateProfileDTO {
  phone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profilePhotoKey?: string;
  bio?: string;
  emergencyContact?: Record<string, unknown>;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
}

export { ChangeRequestField };

export interface CreateChangeRequestDTO {
  field: ChangeRequestField;
  newValue: string;
  reason?: string;
}

export interface ChangeRequestResponseDTO {
  id: string;
  field: ChangeRequestField;
  oldValue: string;
  newValue: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedChangeRequestsDTO {
  items: ChangeRequestResponseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
