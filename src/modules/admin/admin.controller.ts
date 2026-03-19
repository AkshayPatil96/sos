import type { Request, Response } from 'express';
import { UserRole } from '@/generated/prisma/client';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '@/shared/utils/response';
import {
  createUserSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  updateUserProfileSchema,
  reviewProfileChangeSchema,
  listUsersQuerySchema,
  listAuditLogsQuerySchema,
  listProfileChangesQuerySchema,
  userIdParamSchema,
  changeRequestIdParamSchema,
  correctUserEmailSchema,
} from './admin.validator';
import { AdminService } from './admin.service';
import { adminRepository } from './admin.repository';
import { emailService } from '@/lib/email';

const adminService = new AdminService(adminRepository, emailService);

function getActor(req: Request): { id: string; role: UserRole } {
  return { id: req.user!.id, role: req.user!.role as UserRole };
}

function getMeta(req: Request): { ip: string; userAgent: string } {
  return { ip: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new user account
 *     description: |
 *       SUPER_ADMIN can create any role. ADMIN can only create STAFF or STUDENT.
 *       Sends a verification email to the new user.
 *       In development mode, token data is returned in the response instead of being sent via email.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       503:
 *         description: Email service unavailable
 */
export const createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = createUserSchema.parse(req.body);
  const result = await adminService.createUser(input, getActor(req), getMeta(req));
  sendCreated(res, result, 'User created successfully');
});

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users with optional filters and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           $ref: '#/components/schemas/UserRole'
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/UserStatus'
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search by name or email (case-insensitive)
 *     responses:
 *       200:
 *         description: Paginated user list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = listUsersQuerySchema.parse(req.query);
  const { data, pagination } = await adminService.listUsers(query, getActor(req));
  sendPaginated(res, data, pagination, 'Users retrieved successfully');
});

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get full user details including role profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User detail
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = userIdParamSchema.parse(req.params);
  const user = await adminService.getUserById(userId, getActor(req));
  sendSuccess(res, user, 'User retrieved successfully');
});

/**
 * @swagger
 * /admin/users/{userId}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a user's account status
 *     description: Setting status to INACTIVE force-invalidates all active sessions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/UserStatus'
 *     responses:
 *       204:
 *         description: Status updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const updateUserStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = userIdParamSchema.parse(req.params);
  const input = updateUserStatusSchema.parse(req.body);
  await adminService.updateUserStatus(userId, input, getActor(req), getMeta(req));
  sendNoContent(res);
});

/**
 * @swagger
 * /admin/users/{userId}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Change a user's role
 *     description: |
 *       Deletes all active sessions for the user (force re-login).
 *       Creates the corresponding profile record if it doesn't exist.
 *       ADMIN cannot assign ADMIN or SUPER_ADMIN roles.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       204:
 *         description: Role updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const updateUserRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = userIdParamSchema.parse(req.params);
  const input = updateUserRoleSchema.parse(req.body);
  await adminService.updateUserRole(userId, input, getActor(req), getMeta(req));
  sendNoContent(res);
});

/**
 * @swagger
 * /admin/users/{userId}/profile:
 *   patch:
 *     tags: [Admin]
 *     summary: Update admin-controlled profile fields for a user
 *     description: |
 *       Fields are applied to the profile model that matches the user's current role.
 *       Role-mismatched fields are ignored silently by the role-dispatch logic.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               department:
 *                 type: string
 *               employeeId:
 *                 type: string
 *               joiningDate:
 *                 type: string
 *                 format: date-time
 *               designation:
 *                 type: string
 *               reportingTo:
 *                 type: string
 *               course:
 *                 type: string
 *               batch:
 *                 type: string
 *               enrollmentNumber:
 *                 type: string
 *               admissionDate:
 *                 type: string
 *                 format: date-time
 *               academicYear:
 *                 type: string
 *               section:
 *                 type: string
 *     responses:
 *       204:
 *         description: Profile updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const updateUserProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = userIdParamSchema.parse(req.params);
    const input = updateUserProfileSchema.parse(req.body);
    await adminService.updateUserProfile(userId, input, getActor(req), getMeta(req));
    sendNoContent(res);
  },
);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: List audit log entries with optional filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *     responses:
 *       200:
 *         description: Paginated audit log list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const listAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = listAuditLogsQuerySchema.parse(req.query);
  const { data, pagination } = await adminService.listAuditLogs(query, getActor(req));
  sendPaginated(res, data, pagination, 'Audit logs retrieved successfully');
});

/**
 * @swagger
 * /admin/profile-changes:
 *   get:
 *     tags: [Admin]
 *     summary: List profile change requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: field
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of profile change requests
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const listProfileChangeRequests = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = listProfileChangesQuerySchema.parse(req.query);
    const { data, pagination } = await adminService.listProfileChangeRequests(query, getActor(req));
    sendPaginated(res, data, pagination, 'Profile change requests retrieved successfully');
  },
);

/**
 * @swagger
 * /admin/profile-changes/{requestId}/approve:
 *   post:
 *     tags: [Admin]
 *     summary: Approve a profile change request and apply the new value
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewNote:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       204:
 *         description: Change request approved and applied
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const approveProfileChange = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { requestId } = changeRequestIdParamSchema.parse(req.params);
    const input = reviewProfileChangeSchema.parse(req.body);
    await adminService.approveProfileChange(requestId, input, getActor(req), getMeta(req));
    sendNoContent(res);
  },
);

/**
 * @swagger
 * /admin/profile-changes/{requestId}/reject:
 *   post:
 *     tags: [Admin]
 *     summary: Reject a profile change request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewNote:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       204:
 *         description: Change request rejected
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export const rejectProfileChange = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { requestId } = changeRequestIdParamSchema.parse(req.params);
    const input = reviewProfileChangeSchema.parse(req.body);
    await adminService.rejectProfileChange(requestId, input, getActor(req), getMeta(req));
    sendNoContent(res);
  },
);

/**
 * @swagger
 * /admin/users/{userId}/resend-verification:
 *   post:
 *     tags: [Admin]
 *     summary: Resend email verification link to an unverified user
 *     description: |
 *       Deletes any existing verification tokens and sends a fresh verification email.
 *       Can only be used for users whose email is not yet verified.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       503:
 *         description: Email service unavailable
 */
export const resendVerificationEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = userIdParamSchema.parse(req.params);
    const result = await adminService.resendVerificationEmail(userId, getActor(req), getMeta(req));
    sendSuccess(res, result, 'Verification email resent successfully');
  },
);

/**
 * @swagger
 * /admin/users/{userId}/email:
 *   patch:
 *     tags: [Admin]
 *     summary: Correct a user's email address
 *     description: |
 *       Updates the user's email, marks it as unverified, deletes old verification tokens,
 *       creates a new verification token, and sends a fresh verification email.
 *       In development mode, token data is returned in the response instead of being sent via email.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email updated and verification sent
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Email address already in use
 *       503:
 *         description: Email service unavailable
 */
export const correctUserEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = userIdParamSchema.parse(req.params);
  const input = correctUserEmailSchema.parse(req.body);
  const result = await adminService.correctUserEmail(userId, input, getActor(req), getMeta(req));
  sendSuccess(res, result, 'Email updated and verification sent');
});
