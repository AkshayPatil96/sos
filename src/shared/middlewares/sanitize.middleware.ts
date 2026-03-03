import type { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitizes a value:
 * - Trims whitespace from strings
 * - Removes null bytes
 * - Lowercases strings when the parent key is 'email'
 */
function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    let sanitized = value.trim().replace(/\0/g, '');
    if (key === 'email') {
      sanitized = sanitized.toLowerCase();
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeValue(v, k);
    }
    return result;
  }

  return value;
}

/**
 * Global input sanitization middleware.
 * Applied before controllers — normalizes req.body, req.query, req.params.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    const sanitized = sanitizeValue(req.body) as Record<string, unknown>;
    Object.assign(req.body, sanitized);
  }
  if (req.query && typeof req.query === 'object') {
    const sanitized = sanitizeValue(req.query) as Record<string, unknown>;
    // Clear existing keys and reassign sanitized values
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, sanitized);
  }
  if (req.params && typeof req.params === 'object') {
    const sanitized = sanitizeValue(req.params) as Record<string, unknown>;
    Object.assign(req.params, sanitized);
  }
  next();
}
