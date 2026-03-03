import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';

import { config } from '@/shared/config';
import { sanitizeInput } from '@/shared/middlewares/sanitize.middleware';
import { morganMiddleware } from '@/shared/middlewares/morgan.middleware';
import { rateLimiter } from '@/shared/middlewares/rateLimiter.middleware';
import { notFoundHandler } from '@/shared/middlewares/notFound.middleware';
import { globalErrorHandler } from '@/shared/middlewares/error.middleware';
import { apiRouter } from '@/routes/index';
import { setupSwagger } from '@/docs/swagger';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../package.json') as { version: string };

const app: Application = express();

// 1. Request ID — attach uuid to every request and expose as header
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// 2. Security headers
app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: true,
  }),
);

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

// 9. Rate limiter on /api paths
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
// 10. Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
    version: pkg.version,
    uptime: process.uptime(),
  });
});

// 11. Swagger docs (before apiRouter and notFoundHandler)
setupSwagger(app);

// 12. API routes
app.use('/api/v1', apiRouter);

// 13. 404 handler — must come after all routes
app.use(notFoundHandler);

// 14. Global error handler — must be 4-argument middleware, last in chain
app.use(globalErrorHandler);

export default app;
