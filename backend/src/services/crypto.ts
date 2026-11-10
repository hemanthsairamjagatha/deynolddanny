// Web Crypto services — OTP generation, hashing, token generation

/**
 * Generates a cryptographically random 6-digit OTP.
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
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time OTP verification to prevent timing attacks.
 */
export async function verifyOtp(otp: string, salt: string, storedHash: string): Promise<boolean> {
  const hash = await hashOtp(otp, salt);
  if (hash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generates a 64-character hex refresh token (256 bits of entropy).
 */
export function generateRefreshToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a prefixed ID using 12 random bytes (24 hex chars).
 * Example: generateId('usr_') → 'usr_a1b2c3d4e5f6a1b2c3d4e5f6'
 */
export function generateId(prefix: string): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + hex;
}
