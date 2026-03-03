import type { Request, Response } from 'express';

/**
 * Catches all unmatched routes and returns a 404 ROUTE_NOT_FOUND response.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}
