import type { Request, Response, NextFunction } from 'express';
import { cache } from '@/lib/cache';
import { requestContext } from '@/lib/requestContext';
import { verifyAccessToken } from '@/shared/utils/jwt';
import { Errors } from '@/shared/utils/AppError';
import { asyncHandler } from '@/shared/utils/asyncHandler';

/**
 * Verifies the Bearer access token on every protected route.
 *
 * 1. Reads `Authorization: Bearer <token>` header
 * 2. Verifies the JWT signature and expiry
 * 3. Checks the JTI blacklist in cache (set on logout/password change)
 * 4. Populates `req.user` for downstream handlers
 * 5. Mutates the AsyncLocalStorage context so that `writeAuditLog` automatically
 *    picks up userId/userRole without explicit passing
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw Errors.unauthorized('Authentication required');
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    // Check if this JTI has been blacklisted (logout or password change)
    const isBlacklisted = await cache.get<true>(`auth:blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw Errors.unauthorized('Token has been revoked');
    }

    // Populate req.user for controller/service use
    req.user = { id: payload.sub, role: payload.role, jti: payload.jti };

    // Propagate into AsyncLocalStorage so writeAuditLog picks it up automatically
    const ctx = requestContext.getStore();
    if (ctx) {
      ctx.userId = payload.sub;
      ctx.userRole = payload.role;
    }

    next();
  },
);
