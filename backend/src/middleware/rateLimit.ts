/**
 * D1-backed OTP rate limiter.
 * Tracks OTP requests in the `otps` table — never writes to KV.
 * Protects the KV 1,000 writes/day free-tier quota.
 */

/** Returns true if the email is within the allowed OTP rate (< 3 in 15 min). */
export async function checkOtpRateLimit(db: D1Database, email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const result = await db
    .prepare(`SELECT COUNT(*) as count FROM otps WHERE email = ? AND created_at > ?`)
    .bind(email.toLowerCase(), windowStart)
    .first<{ count: number }>();
  return (result?.count ?? 0) < 3;
}

/** Standard 429 response body. */
export function createRateLimitResponse() {
  return {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'You have requested too many verification codes. Please wait 15 minutes before trying again.',
      status: 429,
    },
  } as const;
}

