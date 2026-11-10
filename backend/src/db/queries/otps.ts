import { nowIso } from '../client.js';

// ─── OTP Queries ─────────────────────────────────────────────────────────────

export async function createOtp(
  db: D1Database,
  data: {
    id: string;
    email: string;
    otpHash: string;
    purpose: string;
    expiresAt: string;
    ipAddress?: string | null;
  },
) {
  await db
    .prepare(
      `INSERT INTO otps (id, email, otp_hash, purpose, expires_at, ip_address, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      data.id,
      data.email.toLowerCase(),
      data.otpHash,
      data.purpose,
      data.expiresAt,
      data.ipAddress ?? null,
      nowIso(),
    )
    .run();
}

/** Returns the most recent un-consumed, non-expired OTP for an email+purpose. */
export async function findValidOtp(db: D1Database, email: string, purpose: string) {
  return db
    .prepare(
      `SELECT * FROM otps
       WHERE email = ? COLLATE NOCASE
         AND purpose = ?
         AND consumed = 0
         AND attempts < 3
         AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(email.toLowerCase(), purpose)
    .first<Record<string, unknown>>();
}

export async function incrementOtpAttempts(db: D1Database, otpId: string) {
  await db
    .prepare(`UPDATE otps SET attempts = attempts + 1 WHERE id = ?`)
    .bind(otpId)
    .run();
}

export async function consumeOtp(db: D1Database, otpId: string) {
  await db
    .prepare(`UPDATE otps SET consumed = 1 WHERE id = ?`)
    .bind(otpId)
    .run();
}

export async function countRecentOtps(
  db: D1Database,
  email: string,
  windowStart: string,
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM otps WHERE email = ? COLLATE NOCASE AND created_at > ?`,
    )
    .bind(email.toLowerCase(), windowStart)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

