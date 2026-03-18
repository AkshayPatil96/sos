import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped context store.
 * Automatically propagates requestId and userId across all async calls
 * within a single request — no need to pass them as function arguments.
 */

interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the current request context.
 * Returns undefined if called outside of a request (e.g. in a background job).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Returns the requestId for the current request.
 * Returns 'no-request-context' if called outside a request — never throws.
 */
export function getRequestId(): string {
  return requestContext.getStore()?.requestId ?? 'no-request-context';
}

/**
 * Returns the userId for the current request.
 * Returns undefined if the request is unauthenticated.
 */
export function getContextUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}
