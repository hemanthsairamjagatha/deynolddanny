import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/bindings.js';

const ALLOWED_HEADERS =
  'Content-Type, Authorization, x-session-id, Idempotency-Key, X-Request-Id, X-CSRF-Token';
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/**
 * Strict exact-origin CORS middleware.
 * Wildcard hosting suffixes (e.g. `*.pages.dev` or wildcard subdomains) are forbidden.
 */
export const cors = createMiddleware(async (c, next) => {
  const env = c.env as Env;
  const origin = c.req.header('Origin') ?? '';

  const exactAllowed = new Set<string>(
    [
      env.FRONTEND_URL,
      env.ADMIN_URL,
      'https://deynolddanny.com',
      'https://www.deynolddanny.com',
      'https://deynolddanny.pixenox.com',
      ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : []),
    ]
      .filter(Boolean)
      .map((u) => u.replace(/\/$/, '')),
  );

  const normalizedOrigin = origin.replace(/\/$/, '');
  const isLocalDevOrigin =
    (env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) &&
    (/^http:\/\/localhost:\d+$/.test(normalizedOrigin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(normalizedOrigin));

  const isAllowed = !origin || exactAllowed.has(normalizedOrigin) || isLocalDevOrigin;

  if (c.req.method === 'OPTIONS') {
    if (origin && isAllowed) {
      return new Response(null, {
        status: 204,
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
        error: { code: 'FORBIDDEN', message: 'Origin not permitted.', status: 403 },
      },
      403,
    );
  }

  if (origin && !isAllowed) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Origin not permitted.', status: 403 },
      },
      403,
    );
  }

  await next();

  if (origin && isAllowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
    c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
  }
});
