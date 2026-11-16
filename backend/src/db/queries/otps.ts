import { nowIso } from '../client.js';

export async function revokePendingOtps(db: D1Database, email: string, purpose: string) {
  await db
    .prepare(
      `UPDATE otps SET consumed = 1
       WHERE email = ?1 COLLATE NOCASE AND purpose = ?2 AND consumed = 0`,
    )
    .bind(email.toLowerCase(), purpose)
    .run();
}

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

export async function findValidOtp(db: D1Database, email: string, purpose: string) {
  return db
    .prepare(
      `SELECT * FROM otps
       WHERE email = ?1 COLLATE NOCASE
         AND purpose = ?2
         AND consumed = 0
         AND attempts < 3
         AND expires_at > ?3
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(email.toLowerCase(), purpose, nowIso())
    .first<Record<string, unknown>>();
}

export async function incrementOtpAttempts(db: D1Database, otpId: string) {
  await db
    .prepare(`UPDATE otps SET attempts = attempts + 1 WHERE id = ?1`)
    .bind(otpId)
    .run();
}

export async function consumeOtp(db: D1Database, otpId: string) {
  await db
    .prepare(`UPDATE otps SET consumed = 1 WHERE id = ?1`)
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
      `SELECT COUNT(*) as count FROM otps WHERE email = ?1 COLLATE NOCASE AND created_at > ?2`,
    )
    .bind(email.toLowerCase(), windowStart)
    .first<{ count: number }>();
  return result?.count ?? 0;
}
