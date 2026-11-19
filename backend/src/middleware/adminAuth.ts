import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Context } from 'hono';
import { verifyAccessToken, type JwtPayload } from '../services/jwt.js';
import { generateId } from '../services/crypto.js';
import { nowIso } from '../db/client.js';
import type { Env } from '../types/bindings.js';

declare module 'hono' {
  interface ContextVariableMap {
    adminRoleSlug: string;
    adminPermissions: string[];
    mfaEnabled: boolean;
    mfaVerified: boolean;
    mfaSetupRequired: boolean;
  }
}

export interface AdminAccessProfile {
  isAdmin: boolean;
  roleSlug: string;
  permissions: string[];
  mfaEnabled: boolean;
  mfaRequiredByPolicy: boolean;
}

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
 * Resolves verified server-side admin access & granular permissions from Env ADMIN_EMAILS + D1 RBAC.
 * Fail-closed: altering `users.role` in DB without being in `ADMIN_EMAILS` OR having an explicit
 * active `admin_staff_grants` row created by a Super Admin is always denied.
 */
export async function resolveAdminAccessProfile(
  env: Env,
  user: {
    id: string;
    email: string;
    role: string;
    admin_role_id?: string | null;
    mfa_enabled?: number | null;
  },
): Promise<AdminAccessProfile> {
  const adminEmails =
    env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
  const inAllowlist = adminEmails.includes(user.email.toLowerCase());
  const dbIsPrivileged = user.role === 'admin' || user.role === 'superadmin' || user.role === 'staff';

  if (!dbIsPrivileged) {
    return {
      isAdmin: false,
      roleSlug: 'customer',
      permissions: [],
      mfaEnabled: false,
      mfaRequiredByPolicy: false,
    };
  }

  let grantRoleId: string | null = null;
  if (!inAllowlist) {
    const grant = await env.DB
      .prepare(
        `SELECT role_id, is_active FROM admin_staff_grants WHERE user_id = ?1 LIMIT 1`,
      )
      .bind(user.id)
      .first<{ role_id: string; is_active: number }>();

    if (!grant || grant.is_active !== 1) {
      return {
        isAdmin: false,
        roleSlug: 'customer',
        permissions: [],
        mfaEnabled: false,
        mfaRequiredByPolicy: false,
      };
    }
    grantRoleId = grant.role_id;
  } else {
    grantRoleId = user.admin_role_id ?? null;
  }

  // Bootstrap allowlist superadmin without assigned restricted role gets full wildcard access
  if (inAllowlist && (!grantRoleId || user.role === 'superadmin')) {
    return {
      isAdmin: true,
      roleSlug: 'super_admin',
      permissions: ['*'],
      mfaEnabled: Number(user.mfa_enabled ?? 0) === 1,
      mfaRequiredByPolicy: false,
    };
  }

  const effectiveRoleId = grantRoleId || 'role_super_admin';
  const [roleRow, permRows] = await Promise.all([
    env.DB
      .prepare(`SELECT slug, mfa_required FROM admin_roles WHERE id = ?1 LIMIT 1`)
      .bind(effectiveRoleId)
      .first<{ slug: string; mfa_required: number }>(),
    env.DB
      .prepare(`SELECT permission_code FROM role_permissions WHERE role_id = ?1`)
      .bind(effectiveRoleId)
      .all<{ permission_code: string }>(),
  ]);

  const permissions = (permRows.results ?? []).map((p) => p.permission_code);
  const roleSlug = roleRow?.slug ?? (inAllowlist ? 'super_admin' : 'staff');
  if (inAllowlist && permissions.length === 0) {
    permissions.push('*');
  }

  return {
    isAdmin: inAllowlist || permissions.length > 0,
    roleSlug,
    permissions,
    mfaEnabled: Number(user.mfa_enabled ?? 0) === 1,
    mfaRequiredByPolicy: Number(roleRow?.mfa_required ?? 0) === 1,
  };
}

export function hasAdminPermission(permissions: string[] | undefined, required: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  const modulePrefix = required.split('.')[0];
  return permissions.includes(`${modulePrefix}.*`);
}

/**
 * adminAuth — requires:
 * 1) Valid Cloudflare Access assertion (if configured)
 * 2) Valid Bearer JWT (supporting JWT_SECRET_PREV rotation)
 * 3) Active D1 user matching token_version & verified admin allowlist or Super-Admin grant
 * 4) Verified TOTP MFA if user has mfa_enabled = 1 (exempting /ping and /session/mfa/*)
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
  let payload: JwtPayload;

  try {
    payload = await verifyAccessToken(token, env.JWT_SECRET, env.JWT_SECRET_PREV);
  } catch {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token is invalid or has expired.', status: 401 } },
      401,
    );
  }

  const dbUser = await env.DB
    .prepare(
      `SELECT id, email, role, is_active, token_version, admin_role_id, mfa_enabled
       FROM users WHERE id = ?1 LIMIT 1`,
    )
    .bind(payload.sub)
    .first<{
      id: string;
      email: string;
      role: string;
      is_active: number;
      token_version: number;
      admin_role_id: string | null;
      mfa_enabled: number;
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

  const profile = await resolveAdminAccessProfile(env, dbUser);
  if (!profile.isAdmin) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access restricted to authorized administrators.', status: 403 } },
      403,
    );
  }

  const mfaVerified = Boolean(payload.mfa);
  const path = new URL(c.req.url).pathname;
  const isMfaExemptPath =
    path.endsWith('/api/admin/ping') ||
    path.includes('/api/admin/mfa');

  if (profile.mfaEnabled && !mfaVerified && !isMfaExemptPath) {
    return c.json(
      {
        success: false,
        error: {
          code: 'MFA_REQUIRED',
          message: 'Multi-factor authentication verification is required for this session.',
          status: 403,
        },
      },
      403,
    );
  }

  c.set('userId', dbUser.id);
  c.set('userEmail', dbUser.email);
  c.set('userRole', dbUser.role);
  c.set('adminRoleSlug', profile.roleSlug);
  c.set('adminPermissions', profile.permissions);
  c.set('mfaEnabled', profile.mfaEnabled);
  c.set('mfaVerified', mfaVerified);
  c.set('mfaSetupRequired', profile.mfaRequiredByPolicy && !profile.mfaEnabled);

  await next();
});

/**
 * Granular permission enforcement middleware. Supports any-of permission matching.
 */
export function requirePermission(...requiredCodes: string[]) {
  return createMiddleware(async (c, next) => {
    const perms = c.get('adminPermissions') ?? [];
    const allowed = requiredCodes.some((code) => hasAdminPermission(perms, code));
    if (!allowed) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: `Insufficient permissions. Required: ${requiredCodes.join(' or ')}.`,
            status: 403,
          },
        },
        403,
      );
    }
    await next();
  });
}

/**
 * Centralized immutable admin audit logger.
 */
export async function auditAdminAction(
  c: Context<{ Bindings: Env }>,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: unknown,
): Promise<void> {
  const adminId = c.get('userId') || 'system';
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || null;
  await c.env.DB
    .prepare(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      generateId('log_'),
      adminId,
      action,
      entityType,
      entityId,
      metadata !== undefined ? JSON.stringify(metadata) : null,
      ip,
      nowIso(),
    )
    .run();
}
