import express, { NextFunction, type Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import hpp from 'hpp';
import listEndpoints from 'express-list-endpoints';

import { Sentry } from '@/lib/sentry';
import { register } from '@/lib/metrics';
import { config } from '@/shared/config';
import { metricsMiddleware } from '@/shared/middlewares/metrics.middleware';
import { sanitizeInput } from '@/shared/middlewares/sanitize.middleware';
import { morganMiddleware } from '@/shared/middlewares/morgan.middleware';
import { rateLimiter } from '@/shared/middlewares/rateLimiter.middleware';
import { notFoundHandler } from '@/shared/middlewares/notFound.middleware';
import { globalErrorHandler } from '@/shared/middlewares/error.middleware';
import { apiRouter } from '@/routes/index';
import { setupSwagger } from '@/docs/swagger';
import { logger } from './shared/utils/logger';
import { requestContext } from './lib/requestContext';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../package.json') as { version: string };

const app: Application = express();

// 1. Request ID — attach uuid to every request and expose as header
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use((req, _res, next) => {
  requestContext.run({ requestId: req.requestId ?? uuidv4() }, next);
});

// 2. Security headers
app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: true,
  }),
);
app.use(hpp());

// 3. CORS
app.use(
  cors({
    origin: config.NODE_ENV === 'production' ? [config.FRONTEND_URL] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }),
);

// 4. JSON body parser
app.use(express.json({ limit: '10mb' }));

// 5. URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Response compression
app.use(compression());

// 7. Input sanitization
app.use(sanitizeInput);

// 8. HTTP request logging
app.use(morganMiddleware);

// 9. Prometheus metrics middleware — before rate limiter so rate-limited reqs are counted
app.use(metricsMiddleware);

// 10. Rate limiter on /api paths
app.use('/api', rateLimiter);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     description: Returns the current health status of the API server.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 env:
 *                   type: string
 *                   example: development
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 */
// 11. Prometheus metrics scrape endpoint
// Accessible only from the internal Docker network in production (not behind /api)
/**
 * Restricts /metrics to internal network access only.
 * Allows localhost and Docker bridge network (172.x.x.x).
 * Blocks all external IPs in production.
 */
function metricsGuard(req: Request, res: Response, next: NextFunction): void {
  if (config.NODE_ENV === 'development') {
    next();
    return;
  }

  const ip = req.ip ?? '';
  const isAllowed =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('172.') || // Docker bridge network
    ip.startsWith('10.'); // Docker swarm / custom networks

  if (!isAllowed) {
    logger.warn('Blocked unauthorized /metrics access', { ip, path: req.path });
    res.status(403).json({ success: false, message: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  next();
}
app.get('/metrics', metricsGuard, async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(String(err));
  }
});

// 12. Dev-only route explorer — lists every registered Express route
// Useful for debugging and cross-checking against your Swagger docs
if (config.NODE_ENV !== 'production') {
  app.get('/api/routes', (_req, res) => {
    res.json(listEndpoints(app));
  });
}

// 13. Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
    version: pkg.version,
    uptime: process.uptime(),
  });
});

// 14. Swagger docs (before apiRouter and notFoundHandler)
setupSwagger(app);

// 15. API routes
app.use('/api/v1', apiRouter);

// 16. Sentry error handler — must be BEFORE notFoundHandler and globalErrorHandler
// Captures all unhandled errors and attaches Sentry trace context to req
Sentry.setupExpressErrorHandler(app);

// 17. 404 handler — must come after all routes
app.use(notFoundHandler);

// 18. Global error handler — must be 4-argument middleware, last in chain
app.use(globalErrorHandler);

export default app;
