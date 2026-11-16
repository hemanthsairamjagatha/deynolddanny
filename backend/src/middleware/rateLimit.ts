/**
 * D1-backed Rate Limiter — protects both auth and public endpoints without consuming KV write quota.
 */

export async function checkD1RateLimit(
  db: D1Database,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetEpoch: number }> {
  const nowEpoch = Math.floor(Date.now() / 1000);
  const nextReset = nowEpoch + windowSeconds;

  // Atomic SQLite UPSERT that resets counter if window expired
  await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_epoch)
       VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_epoch <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
         reset_epoch = CASE WHEN rate_limits.reset_epoch <= ?3 THEN ?2 ELSE rate_limits.reset_epoch END`,
    )
    .bind(key, nextReset, nowEpoch)
    .run();

  const row = await db
    .prepare(`SELECT count, reset_epoch FROM rate_limits WHERE key = ?1`)
    .bind(key)
    .first<{ count: number; reset_epoch: number }>();

  const currentCount = row?.count ?? 1;
  const resetEpoch = row?.reset_epoch ?? nextReset;

  return {
    allowed: currentCount <= maxRequests,
    remaining: Math.max(0, maxRequests - currentCount),
    resetEpoch,
  };
}

/** Returns true if the email is within the allowed OTP rate (< 3 in 15 min). */
export async function checkOtpRateLimit(db: D1Database, email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const result = await db
    .prepare(`SELECT COUNT(*) as count FROM otps WHERE email = ? COLLATE NOCASE AND created_at > ?`)
    .bind(email.toLowerCase(), windowStart)
    .first<{ count: number }>();
  return (result?.count ?? 0) < 3;
}

export function createRateLimitResponse(
  message = 'Too many requests. Please wait before trying again.',
) {
  return {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message,
      status: 429,
    },
  } as const;
}
