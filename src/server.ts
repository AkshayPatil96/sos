// IMPORTANT: @/lib/sentry MUST be the first import so Sentry.init() runs before
// Express, Prisma, or any other module is loaded. Do not move this line.
import '@/lib/sentry';

import http from 'http';
import app from '@/app';
import { config } from '@/shared/config';
import { logger } from '@/shared/utils/logger';
import { prisma } from '@/lib/prisma';

const server = http.createServer(app);

/**
 * Initiates a graceful shutdown sequence.
 * Stops accepting new connections, closes DB, then exits cleanly.
 */
function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received. Shutting down gracefully...`);

  // Force exit if shutdown hangs beyond 30 seconds
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 30_000);

  server.close((): void => {
    void (async (): Promise<void> => {
      try {
        await prisma.$disconnect();
        logger.info('All connections closed.');
        clearTimeout(forceExitTimer);
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown:', err);
        clearTimeout(forceExitTimer);
        process.exit(1);
      }
    })();
  });
}

/**
 * Starts the HTTP server and verifies the database connection.
 */
async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected');

    server.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT} [${config.NODE_ENV}]`);
      logger.info(`API Docs: http://localhost:${config.PORT}/api/docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Register graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker stop signal
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C

void startServer();
