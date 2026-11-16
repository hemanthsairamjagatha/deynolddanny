import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';

/**
 * Registers global error and 404 handlers with environment-safe error masking
 * and requestId correlation.
 */
export function setupErrorHandler(app: Hono<{ Bindings: Env }>): void {
  app.onError((err, c) => {
    const isDev = c.env?.ENVIRONMENT === 'development';
    const requestId = (c.get('requestId' as any) as string | undefined) || crypto.randomUUID();
    const path = c.req.path;
    const method = c.req.method;

    console.error(`[Error ${requestId} ${method} ${path}]`, err.message, err.stack);

    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: isDev
            ? err.message || 'An unexpected error occurred.'
            : 'An unexpected error occurred. Please contact support with reference ID.',
          status: 500,
          requestId,
        },
      },
      500,
    );
  });

  app.notFound((c) => {
    const requestId = (c.get('requestId' as any) as string | undefined) || crypto.randomUUID();
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${c.req.method} ${c.req.path} not found.`,
          status: 404,
          requestId,
        },
      },
      404,
    );
  });
}
