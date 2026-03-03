import { prisma } from '@/lib/prisma';
import { logger } from './logger';

interface AuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes an audit log entry to the database.
 * Failures are silently swallowed — audit log errors must never crash the main request.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: (params.before as object | undefined) ?? undefined,
        after: (params.after as object | undefined) ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log:', { error, params });
  }
}
