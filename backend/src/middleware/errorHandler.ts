import { Hono } from 'hono';
import type { Env } from '../types/bindings.js';

/**
 * Registers a global onError handler and a 404 notFound handler on the
 * provided Hono app instance.
 *
 * Always call this AFTER all routes have been registered so the handlers
 * apply to every route uniformly.
 */
export function setupErrorHandler(app: Hono<{ Bindings: Env }>): void {
  app.onError((err, c) => {
    console.error('[Error]', err.message, err.stack);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Our team has been notified.',
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
          message: `Route ${c.req.method} ${c.req.path} not found.`,
          status: 404,
        },
      },
      404,
    );
  });
}
