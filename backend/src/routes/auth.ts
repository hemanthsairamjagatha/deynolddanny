import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import {
  checkD1RateLimit,
  checkOtpRateLimit,
  createRateLimitResponse,
} from '../middleware/rateLimit.js';
import { authRequired } from '../middleware/auth.js';
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  generateRefreshToken,
  generateId,
} from '../services/crypto.js';
import {
  signAccessToken,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshTokenFromCookie,
} from '../services/jwt.js';
import {
  sendOtpEmail,
  renderDbEmailTemplate,
  sendConfiguredEmail,
} from '../services/resend.js';
import { resolveAdminAccessProfile } from '../middleware/adminAuth.js';
import {
  decryptMfaSecret,
  verifyTotpCode,
  consumeBackupCode,
} from '../services/mfa.js';
import {
  revokePendingOtps,
  createOtp,
  findValidOtp,
  incrementOtpAttempts,
  consumeOtp,
} from '../db/queries/otps.js';
import { getUserByEmail, upsertUser, updateLastLogin } from '../db/queries/users.js';
import { nowIso, runBatch } from '../db/client.js';
import {
  OTP_EXPIRY_MINUTES,
  PREFIX_OTP,
  PREFIX_USER,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '../config/constants.js';

const auth = new Hono<{ Bindings: Env }>();

const emailSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

const verifyOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

// ─── POST /api/auth/send-otp ────────────────────────────────────────────────

auth.post('/send-otp', zValidator('json', emailSchema), async (c) => {
  const { email } = c.req.valid('json');
  const db = c.env.DB;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown';

  const [emailAllowed, ipLimit] = await Promise.all([
    checkOtpRateLimit(db, email),
    checkD1RateLimit(db, `otp_ip:${ip}`, 10, 900),
  ]);

  if (!emailAllowed || !ipLimit.allowed) {
    return c.json(createRateLimitResponse(), 429);
  }

  // Revoke any earlier pending OTPs for this email before issuing a fresh code
  await revokePendingOtps(db, email, 'login');

  const otp = await generateOtp();
  const otpHash = await hashOtp(otp, c.env.JWT_SECRET);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const id = generateId(PREFIX_OTP);

  await createOtp(db, {
    id,
    email,
    otpHash,
    purpose: 'login',
    expiresAt,
    ipAddress: ip,
  });

  if (c.env.RESEND_API_KEY) {
    c.executionCtx.waitUntil(
      (async () => {
        const rendered = await renderDbEmailTemplate(db, 'otp', {
          brandName: 'DEYNOLD DANNY',
          otp,
          conciergeEmail: 'concierge@deynolddanny.com',
        });
        if (rendered) {
          await sendConfiguredEmail(
            c.env.RESEND_API_KEY,
            email,
            rendered.subject,
            rendered.html,
            c.env.RESEND_FROM_EMAIL,
          );
        } else {
          await sendOtpEmail(c.env.RESEND_API_KEY, email, otp, c.env.RESEND_FROM_EMAIL);
        }
      })().catch((err) => {
        console.error('Failed to send OTP email:', err);
      }),
    );
  }

  return c.json({
    success: true,
    data: {
      email,
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      message: 'Verification code sent to your email.',
    },
  });
});

// ─── POST /api/auth/verify-otp ──────────────────────────────────────────────

auth.post('/verify-otp', zValidator('json', verifyOtpSchema), async (c) => {
  const { email, otp } = c.req.valid('json');
  const db = c.env.DB;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  const verifyIpLimit = await checkD1RateLimit(db, `verify_ip:${ip}`, 15, 900);
  if (!verifyIpLimit.allowed) {
    return c.json(createRateLimitResponse(), 429);
  }

  const otpRecord = await findValidOtp(db, email, 'login');
  if (!otpRecord) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_OTP', message: 'Invalid or expired verification code.', status: 400 },
      },
      400,
    );
  }

  const otpId = otpRecord.id as string;
  const currentAttempts = (otpRecord.attempts as number) ?? 0;

  let valid = await verifyOtp(otp, c.env.JWT_SECRET, otpRecord.otp_hash as string);
  if (!valid && c.env.JWT_SECRET_PREV) {
    valid = await verifyOtp(otp, c.env.JWT_SECRET_PREV, otpRecord.otp_hash as string);
  }

  if (!valid) {
    const updatedAttempts = currentAttempts + 1;
    await incrementOtpAttempts(db, otpId);

    if (updatedAttempts >= 3) {
      await consumeOtp(db, otpId);
      return c.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Too many incorrect verification attempts. Please request a new code.',
            status: 429,
          },
        },
        429,
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: `Invalid code. ${3 - updatedAttempts} attempt(s) remaining.`,
          status: 400,
        },
      },
      400,
    );
  }

  await consumeOtp(db, otpId);

  const user = await upsertUser(db, { id: generateId(PREFIX_USER), email });
  if (!user) throw new Error('Failed to create or fetch user');

  if (user.is_active === 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Your account has been deactivated. Please contact client concierge.',
          status: 403,
        },
      },
      403,
    );
  }

  const userId = user.id as string;
  const userRole = (user.role as string) ?? 'customer';
  const tokenVersion = Number(user.token_version ?? 1);
  const fullUserRow = await db
    .prepare(`SELECT id, email, role, full_name, admin_role_id, mfa_enabled FROM users WHERE id = ?1 LIMIT 1`)
    .bind(userId)
    .first<{
      id: string;
      email: string;
      role: string;
      full_name: string | null;
      admin_role_id: string | null;
      mfa_enabled: number;
    }>();

  const adminProfile = await resolveAdminAccessProfile(c.env, {
    id: userId,
    email,
    role: userRole,
    admin_role_id: fullUserRow?.admin_role_id ?? null,
    mfa_enabled: fullUserRow?.mfa_enabled ?? 0,
  });

  await updateLastLogin(db, userId);

  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = await hashOtp(rawRefreshToken, c.env.JWT_SECRET);
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
  ).toISOString();
  const tokenFamily = generateId('fam_');
  const initialMfaVerified = !adminProfile.mfaEnabled;

  await db
    .prepare(
      `INSERT OR REPLACE INTO refresh_tokens (token_hash, user_id, expires_at, created_at, token_family, revoked_at, mfa_verified)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)`,
    )
    .bind(refreshTokenHash, userId, refreshExpiresAt, nowIso(), tokenFamily, initialMfaVerified ? 1 : 0)
    .run();

  const accessToken = await signAccessToken(
    {
      sub: userId,
      email,
      role: userRole,
      ver: tokenVersion,
      mfa: initialMfaVerified,
      adminRole: adminProfile.isAdmin ? adminProfile.roleSlug : undefined,
    },
    c.env.JWT_SECRET,
  );

  // Set refresh token strictly via HttpOnly cookie — NEVER returned in JSON body (SEC-001)
  setRefreshCookie(c as any, rawRefreshToken);

  return c.json({
    success: true,
    data: {
      accessToken,
      mfaRequired: adminProfile.isAdmin && adminProfile.mfaEnabled,
      user: {
        id: userId,
        email,
        fullName: (fullUserRow?.full_name ?? (user.full_name as string)) ?? null,
        role: userRole,
        ...(adminProfile.isAdmin
          ? {
              adminAccess: {
                roleSlug: adminProfile.roleSlug,
                permissions: adminProfile.permissions,
                mfaEnabled: adminProfile.mfaEnabled,
                mfaVerified: initialMfaVerified,
                mfaSetupRequired: adminProfile.mfaRequiredByPolicy && !adminProfile.mfaEnabled,
              },
            }
          : {}),
      },
    },
  });
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────

auth.post('/refresh', async (c) => {
  const rawToken = getRefreshTokenFromCookie(c);
  if (!rawToken) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'No active session cookie.', status: 401 } },
      401,
    );
  }

  let tokenHash = await hashOtp(rawToken, c.env.JWT_SECRET);
  let record = await c.env.DB
    .prepare(
      `SELECT rt.token_hash, rt.user_id, rt.expires_at, rt.token_family, rt.revoked_at, rt.mfa_verified,
              u.email, u.role, u.is_active, u.token_version, u.full_name, u.admin_role_id, u.mfa_enabled
       FROM refresh_tokens rt
       INNER JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?1`,
    )
    .bind(tokenHash)
    .first<{
      token_hash: string;
      user_id: string;
      expires_at: string;
      token_family: string | null;
      revoked_at: string | null;
      mfa_verified: number;
      email: string;
      role: string;
      is_active: number;
      token_version: number;
      full_name: string | null;
      admin_role_id: string | null;
      mfa_enabled: number;
    }>();

  if (!record && c.env.JWT_SECRET_PREV) {
    tokenHash = await hashOtp(rawToken, c.env.JWT_SECRET_PREV);
    record = await c.env.DB
      .prepare(
        `SELECT rt.token_hash, rt.user_id, rt.expires_at, rt.token_family, rt.revoked_at, rt.mfa_verified,
                u.email, u.role, u.is_active, u.token_version, u.full_name, u.admin_role_id, u.mfa_enabled
         FROM refresh_tokens rt
         INNER JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = ?1`,
      )
      .bind(tokenHash)
      .first();
  }

  if (!record) {
    clearRefreshCookie(c as any);
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh session.', status: 401 } },
      401,
    );
  }

  // Reuse detection: if an already-revoked token is replayed, revoke the entire family
  if (record.revoked_at) {
    if (record.token_family) {
      await c.env.DB
        .prepare(`DELETE FROM refresh_tokens WHERE token_family = ?1`)
        .bind(record.token_family)
        .run();
    }
    clearRefreshCookie(c as any);
    return c.json(
      { success: false, error: { code: 'TOKEN_REUSE_DETECTED', message: 'Session revoked for security.', status: 401 } },
      401,
    );
  }

  if (record.expires_at < nowIso()) {
    await c.env.DB
      .prepare(`DELETE FROM refresh_tokens WHERE token_hash = ?1`)
      .bind(tokenHash)
      .run();
    clearRefreshCookie(c as any);
    return c.json(
      { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired. Please sign in again.', status: 401 } },
      401,
    );
  }

  if (record.is_active === 0) {
    clearRefreshCookie(c as any);
    return c.json(
      { success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account deactivated.', status: 403 } },
      403,
    );
  }

  const now = nowIso();
  const newRawRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = await hashOtp(newRawRefreshToken, c.env.JWT_SECRET);
  const newExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
  ).toISOString();

  const adminProfile = await resolveAdminAccessProfile(c.env, {
    id: record.user_id,
    email: record.email,
    role: record.role,
    admin_role_id: record.admin_role_id,
    mfa_enabled: record.mfa_enabled,
  });
  const mfaVerified = !adminProfile.mfaEnabled || Number(record.mfa_verified ?? 0) === 1;

  // Mark old token revoked rather than deleting immediately so replay triggers family revocation
  await runBatch(c.env.DB, [
    c.env.DB
      .prepare(`UPDATE refresh_tokens SET revoked_at = ?1 WHERE token_hash = ?2`)
      .bind(now, tokenHash),
    c.env.DB
      .prepare(
        `INSERT INTO refresh_tokens (token_hash, user_id, expires_at, created_at, token_family, revoked_at, mfa_verified)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)`,
      )
      .bind(
        newRefreshTokenHash,
        record.user_id,
        newExpiresAt,
        now,
        record.token_family || generateId('fam_'),
        mfaVerified ? 1 : 0,
      ),
  ]);

  const accessToken = await signAccessToken(
    {
      sub: record.user_id,
      email: record.email,
      role: record.role,
      ver: Number(record.token_version ?? 1),
      mfa: mfaVerified,
      adminRole: adminProfile.isAdmin ? adminProfile.roleSlug : undefined,
    },
    c.env.JWT_SECRET,
  );

  setRefreshCookie(c as any, newRawRefreshToken);

  return c.json({
    success: true,
    data: {
      accessToken,
      mfaRequired: adminProfile.isAdmin && adminProfile.mfaEnabled && !mfaVerified,
      user: {
        id: record.user_id,
        email: record.email,
        fullName: record.full_name,
        role: record.role,
        ...(adminProfile.isAdmin
          ? {
              adminAccess: {
                roleSlug: adminProfile.roleSlug,
                permissions: adminProfile.permissions,
                mfaEnabled: adminProfile.mfaEnabled,
                mfaVerified,
                mfaSetupRequired: adminProfile.mfaRequiredByPolicy && !adminProfile.mfaEnabled,
              },
            }
          : {}),
      },
    },
  });
});

// ─── POST /api/auth/admin/mfa/verify ────────────────────────────────────────

const mfaVerifySchema = z.object({
  code: z.string().min(6).max(20),
});

auth.post('/admin/mfa/verify', authRequired, zValidator('json', mfaVerifySchema), async (c) => {
  const userId = c.get('userId');
  const { code } = c.req.valid('json');
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  const limit = await checkD1RateLimit(c.env.DB, `mfa_verify:${userId}:${ip}`, 8, 900);
  if (!limit.allowed) {
    return c.json(createRateLimitResponse('Too many MFA attempts. Try again later.'), 429);
  }

  const user = await c.env.DB
    .prepare(
      `SELECT id, email, role, full_name, token_version, admin_role_id, mfa_enabled
       FROM users WHERE id = ?1 AND is_active = 1 LIMIT 1`,
    )
    .bind(userId)
    .first<{
      id: string;
      email: string;
      role: string;
      full_name: string | null;
      token_version: number;
      admin_role_id: string | null;
      mfa_enabled: number;
    }>();

  if (!user) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'User not found.', status: 401 } },
      401,
    );
  }

  const adminProfile = await resolveAdminAccessProfile(c.env, user);
  if (!adminProfile.isAdmin) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin privileges required.', status: 403 } },
      403,
    );
  }

  const mfaRow = await c.env.DB
    .prepare(`SELECT totp_secret_enc, backup_hashes_json FROM admin_mfa_secrets WHERE user_id = ?1 LIMIT 1`)
    .bind(userId)
    .first<{ totp_secret_enc: string; backup_hashes_json: string }>();

  if (!mfaRow) {
    return c.json(
      { success: false, error: { code: 'MFA_NOT_CONFIGURED', message: 'MFA is not configured for this account.', status: 400 } },
      400,
    );
  }

  const plainSecret = await decryptMfaSecret(mfaRow.totp_secret_enc, c.env.JWT_SECRET);
  let matched = await verifyTotpCode(plainSecret, code);
  if (!matched) {
    const backup = await consumeBackupCode(code, mfaRow.backup_hashes_json, c.env.JWT_SECRET);
    if (backup.matched) {
      matched = true;
      await c.env.DB
        .prepare(`UPDATE admin_mfa_secrets SET backup_hashes_json = ?1, updated_at = ?2 WHERE user_id = ?3`)
        .bind(backup.remainingJson, nowIso(), userId)
        .run();
    }
  }

  if (!matched) {
    return c.json(
      { success: false, error: { code: 'INVALID_MFA_CODE', message: 'Invalid authenticator or backup code.', status: 400 } },
      400,
    );
  }

  const rawCookie = getRefreshTokenFromCookie(c);
  if (rawCookie) {
    const hash = await hashOtp(rawCookie, c.env.JWT_SECRET);
    await c.env.DB
      .prepare(`UPDATE refresh_tokens SET mfa_verified = 1 WHERE token_hash = ?1 AND user_id = ?2`)
      .bind(hash, userId)
      .run();
  }

  const accessToken = await signAccessToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.token_version,
      mfa: true,
      adminRole: adminProfile.roleSlug,
    },
    c.env.JWT_SECRET,
  );

  return c.json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        adminAccess: {
          roleSlug: adminProfile.roleSlug,
          permissions: adminProfile.permissions,
          mfaEnabled: true,
          mfaVerified: true,
          mfaSetupRequired: false,
        },
      },
    },
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

auth.get('/me', authRequired, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB
    .prepare(`SELECT id, email, full_name, role, is_active, admin_role_id, mfa_enabled FROM users WHERE id = ?1`)
    .bind(userId)
    .first<{
      id: string;
      email: string;
      full_name: string | null;
      role: string;
      is_active: number;
      admin_role_id: string | null;
      mfa_enabled: number;
    }>();

  if (!user || user.is_active === 0) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'User not found or disabled.', status: 401 } },
      401,
    );
  }

  const adminProfile = await resolveAdminAccessProfile(c.env, user);

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        ...(adminProfile.isAdmin
          ? {
              adminAccess: {
                roleSlug: adminProfile.roleSlug,
                permissions: adminProfile.permissions,
                mfaEnabled: adminProfile.mfaEnabled,
                mfaSetupRequired: adminProfile.mfaRequiredByPolicy && !adminProfile.mfaEnabled,
              },
            }
          : {}),
      },
    },
  });
});

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

auth.post('/logout', async (c) => {
  const rawToken = getRefreshTokenFromCookie(c);
  if (rawToken) {
    const tokenHash = await hashOtp(rawToken, c.env.JWT_SECRET);
    const rtRow = await c.env.DB
      .prepare(`SELECT user_id FROM refresh_tokens WHERE token_hash = ?1`)
      .bind(tokenHash)
      .first<{ user_id: string }>();

    if (rtRow) {
      await runBatch(c.env.DB, [
        c.env.DB.prepare(`DELETE FROM refresh_tokens WHERE token_hash = ?1`).bind(tokenHash),
        c.env.DB
          .prepare(`UPDATE users SET token_version = token_version + 1 WHERE id = ?1`)
          .bind(rtRow.user_id),
      ]);
    }
  }
  clearRefreshCookie(c as any);
  return c.json({ success: true, data: { message: 'Logged out successfully.' } });
});

export default auth;
