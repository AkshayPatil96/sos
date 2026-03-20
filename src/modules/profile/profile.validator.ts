import { z } from 'zod';
import { ChangeRequestField } from '@/generated/prisma/client';
import type { CreateChangeRequestDTO } from './profile.types';

export const updateProfileSchema = z.object({
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  profilePhotoKey: z.string().optional(),
  bio: z.string().optional(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianRelation: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changeRequestFieldSchema = z.nativeEnum(ChangeRequestField);

export const createChangeRequestSchema: z.ZodType<CreateChangeRequestDTO> = z.object({
  field: z.nativeEnum(ChangeRequestField),
  newValue: z.string().min(1, 'New value is required'),
  reason: z.string().optional(),
});

export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;

export const profileChangeRequestsQuerySchema = z.object({
  page: z.string().default('1').transform(Number).pipe(z.number().int().min(1)),
  pageSize: z.string().default('10').transform(Number).pipe(z.number().int().min(1).max(100)),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});
