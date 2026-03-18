import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { logger } from '@/shared/utils/logger';
import { Sentry } from '@/lib/sentry';
import { dbQueryDuration } from '@/lib/metrics';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    adapter,
    // Emit query events so we can track slow queries and feed Prometheus
    log: [{ emit: 'event', level: 'query' }],
  });

  /**
   * Slow-query monitor.
   * Every query duration is recorded to the Prometheus histogram.
   * Queries slower than 500 ms are logged as warnings and sent to Sentry.
   */
  client.$on('query', (e) => {
    // Always record in Prometheus regardless of speed
    dbQueryDuration.observe(e.duration);

    if (e.duration > 500) {
      // Truncate query to avoid PII leaking into logs / Sentry
      const truncated = e.query.substring(0, 120);

      logger.warn('Slow query detected', {
        duration: e.duration,
        query: truncated,
      });

      Sentry.captureMessage('Slow database query', {
        level: 'warning',
        extra: {
          duration_ms: e.duration,
          query: truncated,
        },
      });
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
