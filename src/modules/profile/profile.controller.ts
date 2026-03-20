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

/**
 * @swagger
 * /profile/me:
 *   get:
 *     tags: [Profile]
 *     summary: Get own profile
 *     description: Returns the authenticated user's full profile including role-specific fields.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Success
 *                 data:
 *                   $ref: '#/components/schemas/ProfileResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const getMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.user!;
  const profile = await profileService.getMyProfile(id);
  sendSuccess(res, profile);
});

/**
 * @swagger
 * /profile/me:
 *   patch:
 *     tags: [Profile]
 *     summary: Update own editable profile fields
 *     description: Updates user-editable fields only. Fields outside the per-role whitelist are silently ignored.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileInput'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile updated
 *                 data:
 *                   $ref: '#/components/schemas/ProfileResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const updateMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.user!;
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateMyProfile(id, input, getMeta(req));
  sendSuccess(res, profile, 'Profile updated');
});

/**
 * @swagger
 * /profile/me/request-change:
 *   post:
 *     tags: [Profile]
 *     summary: Request a change to an admin-controlled profile field
 *     description: |
 *       Submits a change request for an admin-controlled field (e.g. department, course).
 *       The request is pending until an admin approves or rejects it.
 *
 *       Requestable fields per role:
 *       - ADMIN: department, employeeId, joiningDate
 *       - STAFF: department, designation, employeeId, joiningDate, reportingTo
 *       - STUDENT: department, course, batch, enrollmentNumber, admissionDate, academicYear, section, dateOfBirth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChangeRequestInput'
 *     responses:
 *       200:
 *         description: Change request submitted for review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Change request submitted for review
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Field is not requestable for your role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const requestProfileChange = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.user!;
    const input = createChangeRequestSchema.parse(req.body);
    await profileService.requestChange(id, input, getMeta(req));
    sendSuccess(res, null, 'Change request submitted for review');
  },
);

/**
 * @swagger
 * /profile/me/change-requests:
 *   get:
 *     tags: [Profile]
 *     summary: List your own profile change requests
 *     description: Returns a paginated list of the authenticated user's own change requests.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page (max 100)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Paginated list of change requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChangeRequestResponse'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
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
