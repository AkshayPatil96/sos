import rateLimit from 'express-rate-limit';
import { config } from '@/shared/config';
import { Errors } from '@/shared/utils/AppError';

/**
 * General rate limiter — applied to all /api routes.
 * Uses values from environment config.
 */
export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(Errors.tooManyRequests());
  },
});

/**
 * Strict rate limiter for auth routes — 5 requests per 15 minutes.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(Errors.tooManyRequests());
  },
});
