import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { verifyAccessToken } from '../services/jwt.js';
import type { Env } from '../types/bindings.js';

/**
 * Verifies optional Cloudflare Access JWT assertion when Access protection is enabled
 * via CLOUDFLARE_ACCESS_AUD + CLOUDFLARE_ACCESS_TEAM_DOMAIN.
 */
async function verifyCloudflareAccessIfConfigured(
  env: Env,
  assertion: string | undefined,
): Promise<boolean> {
  if (!env.CLOUDFLARE_ACCESS_AUD || !env.CLOUDFLARE_ACCESS_TEAM_DOMAIN) {
    return true;
  }
  if (!assertion) return false;

  try {
    const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN.replace(/\/$/, '');
    const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    await jwtVerify(assertion, jwks, {
      issuer: teamDomain,
      audience: env.CLOUDFLARE_ACCESS_AUD,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * adminAuth — requires:
 * 1) Valid Bearer JWT (supporting JWT_SECRET_PREV rotation)
 * 2) Active D1 user record matching token_version and admin/superadmin DB role
 * 3) Email in ADMIN_EMAILS allowlist
 * 4) Valid Cloudflare Access assertion if configured in environment
 */
export const adminAuth = createMiddleware(async (c, next) => {
  const env = c.env as Env;

  const accessOk = await verifyCloudflareAccessIfConfigured(
    env,
    c.req.header('Cf-Access-Jwt-Assertion'),
  );
  if (!accessOk) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cloudflare Access verification failed.', status: 403 },
      },
      403,
    );
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing.', status: 401 } },
      401,
    );
  }

  const token = authHeader.slice(7).trim();
  let payload: { sub: string; email: string; role: string; ver?: number };

  try {
    payload = await verifyAccessToken(token, env.JWT_SECRET, env.JWT_SECRET_PREV);
  } catch {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token is invalid or has expired.', status: 401 } },
      401,
    );
  }

  const dbUser = await env.DB
    .prepare(`SELECT id, email, role, is_active, token_version FROM users WHERE id = ?1 LIMIT 1`)
    .bind(payload.sub)
    .first<{
      id: string;
      email: string;
      role: string;
      is_active: number;
      token_version: number;
    }>();

  if (
    !dbUser ||
    dbUser.is_active !== 1 ||
    (typeof payload.ver === 'number' && payload.ver !== dbUser.token_version)
  ) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator session is invalid or revoked.', status: 401 } },
      401,
    );
  }

  if (dbUser.role !== 'admin' && dbUser.role !== 'superadmin') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access restricted to authorized administrators.', status: 403 } },
      403,
    );
  }

  const adminEmails =
    env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!adminEmails.includes(dbUser.email.toLowerCase())) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access restricted to authorized administrators.', status: 403 } },
      403,
    );
  }

  c.set('userId', dbUser.id);
  c.set('userEmail', dbUser.email);
  c.set('userRole', dbUser.role);

  await next();
});
