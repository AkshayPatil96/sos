import { Router, type IRouter } from 'express';
import { requireAuth } from '@/shared/middlewares/auth.middleware';
import {
  getMyProfile,
  updateMyProfile,
  requestProfileChange,
  getMyChangeRequests,
} from './profile.controller';

const router: IRouter = Router();

/**
 * GET /profile/me
 * Returns the authenticated user's full profile (role-specific fields included).
 */
router.get('/me', requireAuth, getMyProfile);

/**
 * PATCH /profile/me
 * Updates user-editable fields only. Non-whitelisted fields are silently ignored.
 */
router.patch('/me', requireAuth, updateMyProfile);

/**
 * POST /profile/me/request-change
 * Submits a change request for an admin-controlled field.
 * The request goes to an admin for approval/rejection.
 */
router.post('/me/request-change', requireAuth, requestProfileChange);

/**
 * GET /profile/me/change-requests
 * Returns paginated list of the authenticated user's own change requests.
 * Optional query params: ?page=1&pageSize=10&status=PENDING
 */
router.get('/me/change-requests', requireAuth, getMyChangeRequests);

export { router as profileRouter };
