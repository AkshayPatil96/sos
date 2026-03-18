import type { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '@/lib/metrics';

/**
 * Prometheus HTTP metrics middleware.
 * Records request count and duration, labelled by method, route, and status code.
 *
 * Route normalisation: uses req.route.path (set by Express after routing) so
 * /students/123 and /students/456 collapse to the same label /students/:studentId,
 * preventing metric cardinality explosion from high-entropy IDs.
 *
 * Mount BEFORE the rate-limiter so rate-limited requests are also counted.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;

    // Prefer the matched route pattern; fall back to raw path for unmatched routes (404s)
    const route = (req.route as { path?: string } | undefined)?.path ?? req.path;

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
}
