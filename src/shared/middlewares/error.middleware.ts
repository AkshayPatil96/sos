import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { fromZodError } from 'zod-validation-error';

import { AppError } from '@/shared/utils/AppError';
import { logger } from '@/shared/utils/logger';
import { config } from '@/shared/config';
import { Prisma } from '@/generated/prisma/client';
import { Sentry, enableMonitoring } from '@/lib/sentry';

/**
 * Global Express error handler. Must be 4-argument middleware.
 * Handles ZodError, AppError, Prisma errors, JWT errors, and unknown errors.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Case 1 — Zod validation error ──────────────────────────────────────────
  if (err instanceof ZodError) {
    // fromZodError produces a human-readable message AND structured field errors
    const validationError = fromZodError(err, {
      prefix: null, // removes "Validation error: " prefix — we set our own message
      prefixSeparator: '',
      unionSeparator: ', or ',
    });

    // Build field-level error map for frontend form highlighting
    const fieldErrors: Record<string, string[]> = {};
    err.issues.forEach((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'root';
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(issue.message);
    });

    logger.debug('Validation error', {
      path: req.path,
      message: validationError.message, // clean readable message in logs
      errors: fieldErrors,
    });

    res.status(400).json({
      success: false,
      message: validationError.message, // e.g. "email is required; password is too short"
      code: 'VALIDATION_ERROR',
      errors: fieldErrors, // field-level map for frontend
    });
    return;
  }

  // ── Case 2 — Operational AppError ──────────────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    logger.warn(err.message, { path: req.path, code: err.code });
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  // ── Case 3 — Prisma known request errors ───────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        res.status(409).json({
          success: false,
          message: `A record with this ${target} already exists`,
          code: 'DUPLICATE_ENTRY',
        });
        return;
      }
      case 'P2025':
        res.status(404).json({
          success: false,
          message: 'Record not found',
          code: 'NOT_FOUND',
        });
        return;
      case 'P2003':
        res.status(400).json({
          success: false,
          message: 'Referenced record does not exist',
          code: 'INVALID_REFERENCE',
        });
        return;
      case 'P2024':
        res.status(503).json({
          success: false,
          message: 'Database connection timeout',
          code: 'DATABASE_UNAVAILABLE',
        });
        return;
      default:
        logger.error('Prisma error', { code: err.code, meta: err.meta });
        res.status(500).json({
          success: false,
          message: 'A database error occurred',
          code: 'DATABASE_ERROR',
        });
        return;
    }
  }

  // ── Case 4 — JWT: expired token ────────────────────────────────────────────
  if (err instanceof TokenExpiredError) {
    res.status(401).json({
      success: false,
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  // ── Case 5 — JWT: invalid or malformed token ───────────────────────────────
  if (err instanceof JsonWebTokenError) {
    res.status(401).json({
      success: false,
      message: 'Invalid or malformed token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // ── Case 6 — Malformed JSON body ───────────────────────────────────────────
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Request body contains invalid JSON',
      code: 'INVALID_JSON',
    });
    return;
  }

  // ── Case 7 — Unknown / non-operational errors ──────────────────────────────
  const errorStack = err instanceof Error ? err.stack : String(err);
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';

  // Report to Sentry — only non-operational errors reach here (bugs, not user errors)
  if (enableMonitoring) {
    Sentry.captureException(err, {
      extra: { path: req.path },
    });
  }

  logger.error('Unhandled error', {
    path: req.path,
    message: errorMessage,
    stack: errorStack,
  });

  const responseBody: Record<string, unknown> = {
    success: false,
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  };

  if (config.NODE_ENV === 'development') {
    responseBody['stack'] = errorStack;
  }

  res.status(500).json(responseBody);
}
