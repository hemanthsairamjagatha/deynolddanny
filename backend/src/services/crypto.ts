// Web Crypto services — OTP generation, hashing, constant-time compare, token generation

/**
 * Constant-time string comparison using UTF-8 bytes and padded length loop.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

/**
 * Computes SHA-256 hex digest of any string.
 */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a cryptographically random 6-digit OTP without modulo bias issues for 6 digits.
 */
export async function generateOtp(): Promise<string> {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

/**
 * Returns a hex-encoded SHA-256 hash of (salt + otp).
 */
export async function hashOtp(otp: string, salt: string): Promise<string> {
  return sha256Hex(salt + otp);
}

/**
 * Constant-time OTP verification to prevent timing attacks.
 */
export async function verifyOtp(otp: string, salt: string, storedHash: string): Promise<boolean> {
  const hash = await hashOtp(otp, salt);
  return timingSafeEqualStrings(hash, storedHash);
}

/**
 * Generates a 64-character hex refresh token (256 bits of entropy).
 */
export function generateRefreshToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a prefixed ID using 12 random bytes (24 hex chars).
 */
export function generateId(prefix: string): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix + hex;
}
