import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@/generated/prisma/client';
import { Errors } from '@/shared/utils/AppError';

/**
 * Express middleware factory that enforces role-based access control.
 * Must be used AFTER `requireAuth` — depends on `req.user` being populated.
 *
 * @param allowedRoles - Roles permitted to access the route
 */
export function requireRole(allowedRoles: UserRole[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      return next(Errors.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(Errors.forbidden());
    }

    next();
  };
}
