import { Router, type IRouter } from 'express';
import { UserRole } from '@/generated/prisma/client';
import { requireAuth } from '@/shared/middlewares/auth.middleware';
import { requireRole } from '@/shared/middlewares/requireRole.middleware';
import * as AdminController from './admin.controller';

const router: IRouter = Router();

/** All admin routes require authentication and at minimum ADMIN role */
router.use(requireAuth, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]));

/**
 * POST /admin/users
 * Create a new user. ADMIN can only create STAFF/STUDENT.
 */
router.post('/users', AdminController.createUser);

/**
 * GET /admin/users
 * Paginated list of all users with optional filters.
 */
router.get('/users', AdminController.listUsers);

/**
 * GET /admin/users/:userId
 * Full user detail including role-specific profile.
 */
router.get('/users/:userId', AdminController.getUserById);

/**
 * PATCH /admin/users/:userId/status
 * Update a user's account status. INACTIVE force-invalidates sessions.
 */
router.patch('/users/:userId/status', AdminController.updateUserStatus);

/**
 * PATCH /admin/users/:userId/role
 * Change a user's role. Forces re-login via session invalidation.
 */
router.patch('/users/:userId/role', AdminController.updateUserRole);

/**
 * PATCH /admin/users/:userId/profile
 * Update admin-controlled fields on the user's role profile.
 */
router.patch('/users/:userId/profile', AdminController.updateUserProfile);

/**
 * GET /admin/audit-logs
 * Paginated audit log entries with optional filters.
 */
router.get('/audit-logs', AdminController.listAuditLogs);

/**
 * GET /admin/profile-changes
 * Paginated profile change requests.
 */
router.get('/profile-changes', AdminController.listProfileChangeRequests);

/**
 * POST /admin/profile-changes/:requestId/approve
 * Approve a pending change request and apply the new value.
 */
router.post('/profile-changes/:requestId/approve', AdminController.approveProfileChange);

/**
 * POST /admin/profile-changes/:requestId/reject
 * Reject a pending change request.
 */
router.post('/profile-changes/:requestId/reject', AdminController.rejectProfileChange);

/**
 * POST /admin/users/:userId/resend-verification
 * Resend email verification link to an unverified user.
 */
router.post('/users/:userId/resend-verification', AdminController.resendVerificationEmail);

/**
 * PATCH /admin/users/:userId/email
 * Correct a user's email address and send a new verification email.
 */
router.patch('/users/:userId/email', AdminController.correctUserEmail);

export { router as adminRouter };
