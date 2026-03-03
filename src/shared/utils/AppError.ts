/**
 * Base operational error class used throughout the application.
 * Use `Errors.*` named constructors instead of instantiating directly.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly timestamp: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Named constructors for common HTTP error types.
 * Always prefer these over throwing raw Error or AppError directly.
 */
export const Errors = {
  /** 404 — resource not found */
  notFound(entity: string, id?: string): AppError {
    const msg = id ? `${entity} with id '${id}' not found` : `${entity} not found`;
    return new AppError(msg, 404, 'ENTITY_NOT_FOUND');
  },

  /** 401 — authentication required */
  unauthorized(msg = 'Authentication required'): AppError {
    return new AppError(msg, 401, 'UNAUTHORIZED');
  },

  /** 403 — authenticated but not permitted */
  forbidden(msg = 'You do not have permission to perform this action'): AppError {
    return new AppError(msg, 403, 'FORBIDDEN');
  },

  /** 409 — unique constraint / duplicate */
  conflict(msg: string): AppError {
    return new AppError(msg, 409, 'CONFLICT');
  },

  /** 400 — client sent invalid data */
  badRequest(msg: string): AppError {
    return new AppError(msg, 400, 'BAD_REQUEST');
  },

  /** 429 — rate limit exceeded */
  tooManyRequests(): AppError {
    return new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED');
  },

  /** 422 — semantically invalid input */
  unprocessable(msg: string): AppError {
    return new AppError(msg, 422, 'UNPROCESSABLE_ENTITY');
  },

  /** 503 — downstream service unavailable */
  serviceUnavailable(msg = 'Service temporarily unavailable'): AppError {
    return new AppError(msg, 503, 'SERVICE_UNAVAILABLE');
  },
} satisfies Record<string, (...args: never[]) => AppError>;
