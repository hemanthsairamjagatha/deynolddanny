import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from '../services/jwt.js';
import type { Env } from '../types/bindings.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    userRole: string;
    requestId: string;
  }
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies JWT signature (supporting dual-key rotation via JWT_SECRET_PREV) AND validates
 * against D1 `users.is_active` and `users.token_version` so revoked/deleted users are blocked immediately.
 */
async function authenticateToken(env: Env, token: string) {
  const payload = await verifyAccessToken(token, env.JWT_SECRET, env.JWT_SECRET_PREV);

  const user = await env.DB
    .prepare(`SELECT id, email, role, is_active, token_version FROM users WHERE id = ?1 LIMIT 1`)
    .bind(payload.sub)
    .first<{
      id: string;
      email: string;
      role: string;
      is_active: number;
      token_version: number;
    }>();

  if (!user || user.is_active !== 1) {
    throw new Error('USER_INACTIVE_OR_MISSING');
  }

  if (typeof payload.ver === 'number' && payload.ver !== user.token_version) {
    throw new Error('TOKEN_REVOKED');
  }

  return {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
}

export const authRequired = createMiddleware(async (c, next) => {
  const env = c.env as Env;
  const token = extractBearerToken(c.req.header('Authorization'));

  if (!token) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing.', status: 401 },
      },
      401,
    );
  }

  try {
    const authUser = await authenticateToken(env, token);
    c.set('userId', authUser.sub);
    c.set('userEmail', authUser.email);
    c.set('userRole', authUser.role);
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is invalid, revoked, or has expired.',
          status: 401,
        },
      },
      401,
    );
  }

  await next();
});

export const authOptional = createMiddleware(async (c, next) => {
  const env = c.env as Env;
  const token = extractBearerToken(c.req.header('Authorization'));

  if (token) {
    try {
      const authUser = await authenticateToken(env, token);
      c.set('userId', authUser.sub);
      c.set('userEmail', authUser.email);
      c.set('userRole', authUser.role);
    } catch {
      // Invalid/revoked token in optional mode falls back to guest
    }
  }

  await next();
});
