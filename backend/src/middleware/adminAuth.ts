import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from '../services/jwt.js';
import type { Env } from '../types/bindings.js';

/**
 * adminAuth — requires a valid JWT AND the user must be admin or superadmin
 * AND their email must be in the ADMIN_EMAILS env var.
 */
export const adminAuth = createMiddleware(async (c, next) => {
  const env = c.env as Env;

  // Extract Bearer token
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing.', status: 401 } },
      401,
    );
  }

  const token = authHeader.slice(7).trim();
  let payload: { sub: string; email: string; role: string };

  try {
    payload = await verifyAccessToken(token, env.JWT_SECRET);
  } catch {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token is invalid or has expired.', status: 401 } },
      401,
    );
  }

  // Role check
  if (payload.role !== 'admin' && payload.role !== 'superadmin') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access restricted to authorized administrators.', status: 403 } },
      403,
    );
  }

  // Email allowlist check
  const adminEmails = env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? [];
  if (!adminEmails.includes(payload.email.toLowerCase())) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access restricted to authorized administrators.', status: 403 } },
      403,
    );
  }

  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userRole', payload.role);

  await next();
});

