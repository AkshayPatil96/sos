import { z } from 'zod';
import {
  UserRole,
  UserStatus,
  ChangeRequestStatus,
  ChangeRequestField,
} from '@/generated/prisma/client';

export const createUserSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.nativeEnum(UserRole),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const updateUserProfileSchema = z
  .object({
    department: z.string().min(1).max(100).trim().optional(),
    employeeId: z.string().min(1).max(50).trim().optional(),
    joiningDate: z.string().datetime({ offset: true }).optional(),
    designation: z.string().min(1).max(100).trim().optional(),
    reportingTo: z.string().cuid().optional(),
    course: z.string().min(1).max(100).trim().optional(),
    batch: z.string().min(1).max(50).trim().optional(),
    enrollmentNumber: z.string().min(1).max(50).trim().optional(),
    admissionDate: z.string().datetime({ offset: true }).optional(),
    academicYear: z.string().min(1).max(20).trim().optional(),
    section: z.string().min(1).max(20).trim().optional(),
  })
  .strict();

export const listUsersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().max(100).trim().optional(),
});

export const listAuditLogsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  userId: z.string().cuid().optional(),
  action: z.string().max(100).trim().optional(),
  entity: z.string().max(100).trim().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export const listProfileChangesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  status: z.nativeEnum(ChangeRequestStatus).optional(),
  userId: z.string().cuid().optional(),
  field: z.nativeEnum(ChangeRequestField).optional(),
});

export const reviewProfileChangeSchema = z.object({
  reviewNote: z.string().max(500).trim().optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string().cuid(),
});

export const changeRequestIdParamSchema = z.object({
  requestId: z.string().cuid(),
});
