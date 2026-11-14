import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { checkOtpRateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';
import { generateOtp, hashOtp, verifyOtp, generateRefreshToken, generateId } from '../services/crypto.js';
import { signAccessToken, verifyAccessToken, setRefreshCookie, clearRefreshCookie, getRefreshTokenFromCookie } from '../services/jwt.js';
import { sendOtpEmail } from '../services/resend.js';
import { createOtp, findValidOtp, incrementOtpAttempts, consumeOtp } from '../db/queries/otps.js';
import { getUserByEmail, upsertUser, updateLastLogin } from '../db/queries/users.js';
import { nowIso } from '../db/client.js';
import {
  OTP_EXPIRY_MINUTES,
  PREFIX_OTP,
  PREFIX_USER,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '../config/constants.js';

const auth = new Hono<{ Bindings: Env }>();

// ─── Schema ─────────────────────────────────────────────────────────────────

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
  const ip = c.req.header('CF-Connecting-IP') ?? null;

  // Rate limit check (D1-backed)
  const allowed = await checkOtpRateLimit(db, email);
  if (!allowed) {
    return c.json(createRateLimitResponse(), 429);
  }

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

  // Fire-and-forget email via waitUntil (never blocks the response)
  if (c.env.RESEND_API_KEY) {
    c.executionCtx.waitUntil(
      sendOtpEmail(c.env.RESEND_API_KEY, email, otp).catch((err) => {
        console.error('Failed to send OTP email via Resend:', err);
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

  const otpRecord = await findValidOtp(db, email, 'login');

  if (!otpRecord) {
    return c.json({
      success: false,
      error: { code: 'INVALID_OTP', message: 'Invalid or expired verification code.', status: 400 },
    }, 400);
  }

  const otpId = otpRecord.id as string;
  const currentAttempts = (otpRecord.attempts as number) ?? 0;

  // Verify OTP (constant-time comparison)
  const valid = await verifyOtp(otp, c.env.JWT_SECRET, otpRecord.otp_hash as string);

  if (!valid) {
    const updatedAttempts = currentAttempts + 1;
    await incrementOtpAttempts(db, otpId);

    // FIX: Brute-force lockout: if 3 attempts reached, permanently consume the code
    if (updatedAttempts >= 3) {
      await consumeOtp(db, otpId);
      return c.json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many incorrect verification attempts. Please request a new code.',
          status: 429,
        },
      }, 429);
    }

    return c.json({
      success: false,
      error: {
        code: 'INVALID_OTP',
        message: `Invalid code. ${3 - updatedAttempts} attempt(s) remaining.`,
        status: 400,
      },
    }, 400);
  }

  // Consume the OTP upon success
  await consumeOtp(db, otpId);

  // Upsert user (creates account on first login automatically)
  const user = await upsertUser(db, { id: generateId(PREFIX_USER), email });
  if (!user) throw new Error('Failed to create or fetch user');

  // FIX: Check if user account is deactivated
  if (user.is_active === 0) {
    return c.json({
      success: false,
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated. Please contact client concierge.',
        status: 403,
      },
    }, 403);
  }

  const userId = user.id as string;
  const userRole = (user.role as string) ?? 'customer';

  await updateLastLogin(db, userId);

  // Generate refresh token and store hash in D1
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = await hashOtp(rawRefreshToken, c.env.JWT_SECRET);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000).toISOString();

  await db
    .prepare(
      `INSERT OR REPLACE INTO refresh_tokens (token_hash, user_id, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(refreshTokenHash, userId, refreshExpiresAt, nowIso())
    .run();

  // Sign access token
  const accessToken = await signAccessToken(
    { sub: userId, email, role: userRole },
    c.env.JWT_SECRET,
  );

  // Set HttpOnly refresh cookie
  setRefreshCookie(c as any, rawRefreshToken);

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: userId,
        email,
        fullName: (user.full_name as string) ?? null,
        role: userRole,
      },
    },
  });
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
// Implements Refresh Token Rotation for strict security

auth.post('/refresh', async (c) => {
  let rawToken = getRefreshTokenFromCookie(c);
  if (!rawToken) {
    const body = await c.req.json().catch(() => ({}));
    rawToken = body?.refreshToken;
  }

  if (!rawToken) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No refresh token.', status: 401 },
    }, 401);
  }

  const tokenHash = await hashOtp(rawToken, c.env.JWT_SECRET);

  const record = await c.env.DB
    .prepare(
      `SELECT rt.*, u.email, u.role, u.is_active FROM refresh_tokens rt
       INNER JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?1
         AND rt.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(tokenHash)
    .first<{ user_id: string; email: string; role: string; is_active: number; expires_at: string }>();

  if (!record) {
    clearRefreshCookie(c as any);
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Refresh token is invalid or expired.', status: 401 },
    }, 401);
  }

  if (record.is_active === 0) {
    clearRefreshCookie(c as any);
    return c.json({
      success: false,
      error: { code: 'ACCOUNT_DISABLED', message: 'Account deactivated.', status: 403 },
    }, 403);
  }

  // ROTATION: Delete the used token
  await c.env.DB
    .prepare(`DELETE FROM refresh_tokens WHERE token_hash = ?1`)
    .bind(tokenHash)
    .run();

  // Issue brand-new refresh token
  const newRawRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = await hashOtp(newRawRefreshToken, c.env.JWT_SECRET);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000).toISOString();

  await c.env.DB
    .prepare(
      `INSERT INTO refresh_tokens (token_hash, user_id, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(newRefreshTokenHash, record.user_id, newExpiresAt, nowIso())
    .run();

  // Sign new access token
  const accessToken = await signAccessToken(
    { sub: record.user_id, email: record.email, role: record.role },
    c.env.JWT_SECRET,
  );

  setRefreshCookie(c as any, newRawRefreshToken);

  return c.json({ success: true, data: { accessToken, refreshToken: newRawRefreshToken } });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No authorization token provided.', status: 401 },
    }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token is invalid or expired.', status: 401 },
    }, 401);
  }

  const user = await c.env.DB
    .prepare(`SELECT id, email, full_name, role, is_active FROM users WHERE id = ?1`)
    .bind(payload.sub)
    .first<{ id: string; email: string; full_name: string | null; role: string; is_active: number }>();

  if (!user || user.is_active === 0) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not found or disabled.', status: 401 },
    }, 401);
  }

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    },
  });
});

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

auth.post('/logout', async (c) => {
  const rawToken = getRefreshTokenFromCookie(c);
  if (rawToken) {
    const tokenHash = await hashOtp(rawToken, c.env.JWT_SECRET);
    await c.env.DB
      .prepare(`DELETE FROM refresh_tokens WHERE token_hash = ?1`)
      .bind(tokenHash)
      .run();
  }
  clearRefreshCookie(c as any);
  return c.json({ success: true, data: { message: 'Logged out successfully.' } });
});

export default auth;
