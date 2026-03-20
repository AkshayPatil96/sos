/**
 * Prometheus metrics registry.
 * All modules must import from here — never create a Registry elsewhere.
 *
 * Exposed via GET /metrics for Prometheus to scrape.
 * In production this endpoint is only reachable from the internal Docker network.
 */
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

/**
 * Initialise default Node.js metrics collection (event loop lag, GC, heap, etc.).
 * Call only when ENABLE_MONITORING=true — starts a 10-second interval timer.
 */
export function initMetrics(): void {
  collectDefaultMetrics({ register });
}

/**
 * Total HTTP requests, labelled by method, normalized route, and status code.
 * Use for request-rate dashboards and error-rate alerts (5xx ratio).
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

/**
 * HTTP request duration in seconds.
 * Use for latency percentile dashboards (p50 / p95 / p99).
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  // Buckets tuned for a typical REST API serving sub-second responses
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Database query duration in milliseconds.
 * Populated by the Prisma slow-query listener in lib/prisma.ts.
 * Use for DB latency dashboards and connection-pool exhaustion alerts.
 */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_ms',
  help: 'Database query duration in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});
