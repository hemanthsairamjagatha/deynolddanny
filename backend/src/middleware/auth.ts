import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from '../services/jwt.js';
import type { Env } from '../types/bindings.js';

// Extend Hono's ContextVariableMap so c.get / c.set are fully typed
// throughout the entire application without additional imports.
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    userRole: string;
  }
}

/** Extracts the raw Bearer token from the Authorization header, or null. */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * authRequired
 *
 * Verifies the JWT access token supplied in the Authorization header.
 * - Missing token  → 401 UNAUTHORIZED
 * - Invalid/expired → 401 UNAUTHORIZED
 * - Valid           → sets userId, userEmail, userRole on context and continues
 */
export const authRequired = createMiddleware(async (c, next) => {
  const env = c.env as Env;
  const token = extractBearerToken(c.req.header('Authorization'));

  if (!token) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is missing.',
          status: 401,
        },
      },
      401,
    );
  }

  try {
    const payload = await verifyAccessToken(token, env.JWT_SECRET);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    c.set('userRole', payload.role);
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is invalid or has expired.',
          status: 401,
        },
      },
      401,
    );
  }

  await next();
});

/**
 * authOptional
 *
 * Attempts to verify the JWT access token when present.
 * - Missing token  → continues without setting user context (guest request)
 * - Invalid/expired → continues without setting user context (treat as guest)
 * - Valid           → sets userId, userEmail, userRole on context and continues
 */
export const authOptional = createMiddleware(async (c, next) => {
  const env = c.env as Env;
  const token = extractBearerToken(c.req.header('Authorization'));

  if (token) {
    try {
      const payload = await verifyAccessToken(token, env.JWT_SECRET);
      c.set('userId', payload.sub);
      c.set('userEmail', payload.email);
      c.set('userRole', payload.role);
    } catch {
      // Silently ignore invalid/expired tokens in optional mode
    }
  }

  await next();
});
