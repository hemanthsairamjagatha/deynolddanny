import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';

/**
 * Registers a global onError handler and a 404 notFound handler on the
 * provided Hono app instance.
 *
 * Catches unhandled exceptions, records structured logs with method and path,
 * and guarantees a consistent, safe JSON error envelope.
 */
export function setupErrorHandler(app: Hono<{ Bindings: Env }>): void {
  app.onError((err, c) => {
    const isDev = c.env?.ENVIRONMENT === 'development';
    const path = c.req.path;
    const method = c.req.method;

    console.error(`[Error ${method} ${path}]`, err.message, err.stack);

    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred. Our team has been notified.',
          status: 500,
        },
      },
      500,
    );
  });

  app.notFound((c) => {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${c.req.method} ${c.req.path} not found.`,
          status: 404,
        },
      },
      404,
    );
  });
}
