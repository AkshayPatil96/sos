import { prisma } from '@/lib/prisma';
import { logger } from './logger';
import { getRequestContext } from '@/lib/requestContext';

interface AuditLogParams {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  severity: 'low' | 'medium' | 'high';
  entity: string; // e.g. "User", "Post", "Order"
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes an audit log entry to the database.
 * Failures are silently swallowed — audit log errors must never crash the main request.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  const context = getRequestContext();

  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? context?.userId,
        userEmail: params.userEmail,
        userRole: params.userRole ?? context?.userRole,
        action: params.action,
        severity: params.severity,
        entity: params.entity,
        entityId: params.entityId,
        before: (params.before as object) ?? undefined,
        after: (params.after as object) ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log:', { error, params });
  }
}
