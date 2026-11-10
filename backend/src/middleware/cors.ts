import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/bindings.js';

const ALLOWED_HEADERS = 'Content-Type, Authorization, x-session-id';
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/**
 * CORS middleware.
 *
 * Reads FRONTEND_URL and ADMIN_URL from the Worker environment and permits
 * only those two origins. Any other origin receives 403. OPTIONS preflight
 * requests are answered with 200 and the appropriate CORS headers so the
 * actual request is not sent.
 *
 * credentials: true is required because the refresh-token is in an HttpOnly
 * cookie and the access token is sent via the Authorization header.
 */
export const cors = createMiddleware(async (c, next) => {
  const env = c.env as Env;
  const origin = c.req.header('Origin') ?? '';

  const allowedOrigins = new Set<string>([
    env.FRONTEND_URL,
    env.ADMIN_URL,
  ]);

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    if (origin && allowedOrigins.has(origin)) {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': ALLOWED_METHODS,
          'Access-Control-Allow-Headers': ALLOWED_HEADERS,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Origin not permitted.',
          status: 403,
        },
      },
      403,
    );
  }

  // Actual request — set headers if origin is allowed, block otherwise
  if (origin && !allowedOrigins.has(origin)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Origin not permitted.',
          status: 403,
        },
      },
      403,
    );
  }

  await next();

  if (origin && allowedOrigins.has(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
    c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
  }
});
