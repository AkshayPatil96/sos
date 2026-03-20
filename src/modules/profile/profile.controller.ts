import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { sendSuccess, sendPaginated } from '@/shared/utils/response';
import {
  updateProfileSchema,
  createChangeRequestSchema,
  profileChangeRequestsQuerySchema,
} from './profile.validator';
import { ProfileService } from './profile.service';
import { profileRepository } from './profile.repository';

const profileService = new ProfileService(profileRepository);

function getMeta(req: Request): { ip: string; userAgent: string } {
  return {
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

export const getMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.user!;
  const profile = await profileService.getMyProfile(id);
  sendSuccess(res, profile);
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.user!;
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateMyProfile(id, input, getMeta(req));
  sendSuccess(res, profile, 'Profile updated');
});

export const requestProfileChange = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.user!;
    const input = createChangeRequestSchema.parse(req.body);
    await profileService.requestChange(id, input, getMeta(req));
    sendSuccess(res, null, 'Change request submitted for review');
  },
);

export const getMyChangeRequests = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.user!;
    const { page, pageSize, status } = profileChangeRequestsQuerySchema.parse(req.query);
    const result = await profileService.getMyChangeRequests(id, { page, pageSize, status });
    sendPaginated(res, result.items, {
      page: result.page,
      limit: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    });
  },
);
