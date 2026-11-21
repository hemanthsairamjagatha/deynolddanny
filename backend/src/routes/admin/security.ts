import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { auditAdminAction, requirePermission } from '../../middleware/adminAuth.js';
import {
  generateBase32Secret,
  buildTotpUri,
  verifyTotpCode,
  encryptMfaSecret,
  decryptMfaSecret,
  generateBackupCodes,
} from '../../services/mfa.js';
import { generateId } from '../../services/crypto.js';

const security = new Hono<{ Bindings: Env }>();

// ─── Staff Management ────────────────────────────────────────────────────────

// GET /staff — list users with admin grants
security.get('/staff', requirePermission('security.manage'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT
       u.id, u.email, u.full_name AS name, u.role, u.is_active, u.mfa_enabled, u.created_at,
       asg.role_id, asg.is_active AS grant_active,
       ar.slug AS role_slug, ar.name AS role_display_name
     FROM users u
     LEFT JOIN admin_staff_grants asg ON asg.user_id = u.id
     LEFT JOIN admin_roles ar ON ar.id = COALESCE(asg.role_id, u.admin_role_id)
     WHERE u.role IN ('admin', 'superadmin') OR asg.user_id IS NOT NULL
     ORDER BY u.created_at DESC`,
  ).all();
  return c.json({ success: true, data: rows.results });
});

// GET /roles — list seeded RBAC roles
security.get('/roles', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, slug, name, description, mfa_required, is_system FROM admin_roles ORDER BY is_system DESC, name ASC`,
  ).all();
  return c.json({ success: true, data: rows.results });
});

// POST /staff — invite/upsert admin user with role
security.post('/staff', requirePermission('security.manage'), async (c) => {
  const body = await c.req.json<{ email?: string; name?: string; role_id?: string; roleId?: string }>();
  const email = body.email?.toLowerCase().trim();
  const roleRef = (body.role_id ?? body.roleId ?? '').trim();
  if (!email || !roleRef) {
    return c.json(
      { success: false, error: { message: 'email and roleId are required' } },
      400,
    );
  }

  // Resolve role by id or slug
  const roleRow = await c.env.DB.prepare(
    `SELECT id, slug FROM admin_roles WHERE id = ? OR slug = ? LIMIT 1`,
  ).bind(roleRef, roleRef).first<{ id: string; slug: string }>();

  if (!roleRow) {
    return c.json({ success: false, error: { message: `Unknown role: ${roleRef}` } }, 400);
  }

  const actor = c.get('userEmail') ?? c.get('userId') ?? 'super_admin';
  let user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
  ).bind(email).first<{ id: string }>();

  const targetUserRole = roleRow.slug === 'super_admin' ? 'superadmin' : 'admin';

  if (!user) {
    const newId = generateId('usr_');
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, full_name, role, admin_role_id, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
    ).bind(newId, email, body.name?.trim() || null, targetUserRole, roleRow.id).run();
    user = { id: newId };
  } else {
    await c.env.DB.prepare(
      `UPDATE users SET role = ?, admin_role_id = ?, full_name = COALESCE(?, full_name), updated_at = datetime('now') WHERE id = ?`,
    ).bind(targetUserRole, roleRow.id, body.name?.trim() || null, user.id).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO admin_staff_grants (user_id, role_id, granted_by, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET role_id = excluded.role_id, granted_by = excluded.granted_by, is_active = 1, updated_at = datetime('now')`,
  ).bind(user.id, roleRow.id, actor).run();

  await auditAdminAction(c, 'INVITE_ADMIN_STAFF', 'user', user.id, { email, roleId: roleRow.id, roleSlug: roleRow.slug });

  return c.json({ success: true, data: { userId: user.id, roleId: roleRow.id } }, 201);
});

// PATCH /staff/:userId/role — change role & force token refresh
security.patch('/staff/:userId/role', requirePermission('security.manage'), async (c) => {
  const { userId } = c.req.param();
  const body = await c.req.json<{ role_id?: string; roleId?: string }>();
  const roleRef = (body.role_id ?? body.roleId ?? '').trim();
  if (!roleRef) {
    return c.json({ success: false, error: { message: 'roleId is required' } }, 400);
  }
  const roleRow = await c.env.DB.prepare(
    `SELECT id, slug FROM admin_roles WHERE id = ? OR slug = ? LIMIT 1`,
  ).bind(roleRef, roleRef).first<{ id: string; slug: string }>();
  if (!roleRow) {
    return c.json({ success: false, error: { message: `Unknown role: ${roleRef}` } }, 400);
  }

  const actor = c.get('userEmail') ?? c.get('userId') ?? 'super_admin';
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO admin_staff_grants (user_id, role_id, granted_by, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET role_id = excluded.role_id, granted_by = excluded.granted_by, is_active = 1, updated_at = datetime('now')`,
    ).bind(userId, roleRow.id, actor),
    c.env.DB.prepare(
      `UPDATE users SET admin_role_id = ?, role = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?`,
    ).bind(roleRow.id, roleRow.slug === 'super_admin' ? 'superadmin' : 'admin', userId),
  ]);

  await auditAdminAction(c, 'UPDATE_STAFF_ROLE', 'user', userId, { roleId: roleRow.id, roleSlug: roleRow.slug });

  return c.json({ success: true });
});

// DELETE /staff/:userId — deactivate grant, demote role, revoke refresh tokens & invalidate JWTs
security.delete('/staff/:userId', requirePermission('security.manage'), async (c) => {
  const { userId } = c.req.param();
  if (userId === c.get('userId')) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You cannot revoke your own administrator access.', status: 400 } },
      400,
    );
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE admin_staff_grants SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?`,
    ).bind(userId),
    c.env.DB.prepare(
      `UPDATE users SET role = 'customer', admin_role_id = NULL, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?`,
    ).bind(userId),
    c.env.DB.prepare(`DELETE FROM refresh_tokens WHERE user_id = ?`).bind(userId),
  ]);
  await auditAdminAction(c, 'REVOKE_ADMIN_STAFF', 'user', userId);
  return c.json({ success: true });
});

// ─── MFA (uses admin_mfa_secrets table from migration 0006) ──────────────────

// GET /mfa/status — current user's MFA status
security.get('/mfa/status', async (c) => {
  const userId = c.get('userId');
  const row = await c.env.DB.prepare(
    `SELECT u.mfa_enabled, m.verified_at
     FROM users u
     LEFT JOIN admin_mfa_secrets m ON m.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
  ).bind(userId).first<{ mfa_enabled: number; verified_at: string | null }>();
  const enabled = row?.mfa_enabled === 1;
  return c.json({
    success: true,
    data: { enabled, mfaEnabled: enabled, verified: Boolean(row?.verified_at) },
  });
});

// POST /mfa/setup — creates encrypted unverified TOTP secret in admin_mfa_secrets
security.post('/mfa/setup', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const secret = generateBase32Secret();
  const uri = buildTotpUri(secret, userEmail);
  const encrypted = await encryptMfaSecret(secret, c.env.JWT_SECRET);

  await c.env.DB.prepare(
    `INSERT INTO admin_mfa_secrets (user_id, totp_secret_enc, backup_hashes_json, verified_at, created_at, updated_at)
     VALUES (?, ?, '[]', NULL, datetime('now'), datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET totp_secret_enc = excluded.totp_secret_enc, verified_at = NULL, updated_at = datetime('now')`,
  ).bind(userId, encrypted).run();

  return c.json({ success: true, data: { secret, uri, qrDataUrl: '' } });
});

// POST /mfa/enable — verify TOTP code and mark admin_mfa_secrets verified + generate backup codes
security.post('/mfa/enable', async (c) => {
  const userId = c.get('userId');
  const { code } = await c.req.json<{ code: string }>();
  if (!code) {
    return c.json({ success: false, error: { message: 'code is required' } }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT totp_secret_enc FROM admin_mfa_secrets WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first<{ totp_secret_enc: string }>();

  if (!row?.totp_secret_enc) {
    return c.json(
      { success: false, error: { message: 'No MFA setup in progress. Call /mfa/setup first.' } },
      400,
    );
  }

  const secret = await decryptMfaSecret(row.totp_secret_enc, c.env.JWT_SECRET);
  const valid = await verifyTotpCode(secret, code);
  if (!valid) {
    return c.json({ success: false, error: { message: 'Invalid TOTP code' } }, 400);
  }

  const { codes, hashes } = await generateBackupCodes(c.env.JWT_SECRET);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE admin_mfa_secrets SET backup_hashes_json = ?, verified_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?`,
    ).bind(JSON.stringify(hashes), userId),
    c.env.DB.prepare(
      `UPDATE users SET mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?`,
    ).bind(userId),
  ]);

  return c.json({ success: true, data: { backupCodes: codes } });
});

// POST /mfa/disable — disable MFA (requires TOTP verification)
security.post('/mfa/disable', async (c) => {
  const userId = c.get('userId');
  const { code } = await c.req.json<{ code: string }>();
  if (!code) {
    return c.json({ success: false, error: { message: 'code is required' } }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT totp_secret_enc FROM admin_mfa_secrets WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first<{ totp_secret_enc: string }>();

  if (!row?.totp_secret_enc) {
    return c.json({ success: false, error: { message: 'MFA is not enabled' } }, 400);
  }

  const secret = await decryptMfaSecret(row.totp_secret_enc, c.env.JWT_SECRET);
  const valid = await verifyTotpCode(secret, code);
  if (!valid) {
    return c.json({ success: false, error: { message: 'Invalid TOTP code' } }, 400);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM admin_mfa_secrets WHERE user_id = ?`).bind(userId),
    c.env.DB.prepare(`UPDATE users SET mfa_enabled = 0, updated_at = datetime('now') WHERE id = ?`).bind(userId),
  ]);

  return c.json({ success: true });
});

// ─── Sessions (uses refresh_tokens.token_hash) ───────────────────────────────

// GET /sessions — list current user's active refresh_tokens
security.get('/sessions', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    `SELECT token_hash AS jti, created_at, expires_at, mfa_verified
     FROM refresh_tokens
     WHERE user_id = ? AND expires_at > datetime('now')
     ORDER BY created_at DESC`,
  ).bind(userId).all();
  return c.json({ success: true, data: rows.results });
});

// DELETE /sessions/:jti — revoke specific session by token_hash
security.delete('/sessions/:jti', async (c) => {
  const userId = c.get('userId');
  const { jti } = c.req.param();
  await c.env.DB.prepare(
    `DELETE FROM refresh_tokens WHERE token_hash = ? AND user_id = ?`,
  ).bind(jti, userId).run();
  return c.json({ success: true });
});

// DELETE /sessions — revoke all sessions and bump token_version for current user
security.delete('/sessions', async (c) => {
  const userId = c.get('userId');
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM refresh_tokens WHERE user_id = ?`).bind(userId),
    c.env.DB.prepare(`UPDATE users SET token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?`).bind(userId),
  ]);
  await auditAdminAction(c, 'REVOKE_ALL_SESSIONS', 'user', userId);
  return c.json({ success: true });
});

// ─── Audit Logs ──────────────────────────────────────────────────────────────

// GET /audit-logs — query admin_logs table joined with users
security.get('/audit-logs', requirePermission('logs.read'), async (c) => {
  const {
    admin_id,
    action,
    entity_type,
    limit = '50',
    page = '1',
    offset,
  } = c.req.query();

  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const off = offset !== undefined ? Number(offset) || 0 : (Math.max(1, Number(page) || 1) - 1) * lim;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (admin_id) { conditions.push('l.admin_id = ?'); params.push(admin_id); }
  if (action) { conditions.push('l.action = ?'); params.push(action); }
  if (entity_type) { conditions.push('l.entity_type = ?'); params.push(entity_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT l.*, u.email AS admin_email
               FROM admin_logs l
               LEFT JOIN users u ON u.id = l.admin_id
               ${where}
               ORDER BY l.created_at DESC
               LIMIT ? OFFSET ?`;
  params.push(lim, off);

  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ success: true, data: rows.results });
});

export default security;
