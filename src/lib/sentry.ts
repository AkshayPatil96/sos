/**
 * Sentry initialisation — MUST be the first module imported in server.ts.
 * Calling Sentry.init() here (at module-load time) guarantees it runs before
 * Express, Prisma, or any other module is set up.
 */
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV ?? 'development';
const enableMonitoring = process.env.ENABLE_MONITORING === 'true';

if (dsn && enableMonitoring) {
  Sentry.init({
    dsn,
    environment,
    integrations: [
      nodeProfilingIntegration(), // CPU profiling — requires native build (pnpm approve-builds)
    ],
    // Capture 10 % of transactions in prod, 100 % in dev/staging
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,
    // Never send PII automatically (IPs, user agents attached to breadcrumbs)
    sendDefaultPii: false,
  });
}

export { Sentry };
export { enableMonitoring };
