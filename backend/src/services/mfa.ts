// WebCrypto TOTP (RFC 6238), AES-GCM secret protection, backup codes, and CMS preview tokens

import { SignJWT, jwtVerify } from 'jose';
import { sha256Hex, timingSafeEqualStrings } from './crypto.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function generateTotpCode(
  base32Secret: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
  digits = 6,
): Promise<string> {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);

  const keyBytes = decodeBase32(base32Secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuf));
  const offset = sig[sig.length - 1] & 0x0f;
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, '0');
}

export async function verifyTotpCode(
  base32Secret: string,
  code: string,
  timestampMs = Date.now(),
  windowSteps = 1,
): Promise<boolean> {
  const clean = code.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;

  for (let delta = -windowSteps; delta <= windowSteps; delta += 1) {
    const candidate = await generateTotpCode(base32Secret, timestampMs + delta * 30_000);
    if (timingSafeEqualStrings(candidate, clean)) {
      return true;
    }
  }
  return false;
}

export function buildTotpUri(secret: string, email: string, issuer = 'DEYNOLD DANNY Commerce OS'): string {
  const encIssuer = encodeURIComponent(issuer);
  const encLabel = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${encLabel}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

async function deriveAesKey(masterSecret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`dd-mfa-v1:${masterSecret}`),
  );
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptMfaSecret(plainSecret: string, masterSecret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(masterSecret);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plainSecret),
    ),
  );
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
  const cHex = Array.from(cipher).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${ivHex}.${cHex}`;
}

export async function decryptMfaSecret(encrypted: string, masterSecret: string): Promise<string> {
  const [ivHex, cHex] = encrypted.split('.');
  if (!ivHex || !cHex) throw new Error('Malformed encrypted MFA secret');
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const cipher = new Uint8Array(cHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await deriveAesKey(masterSecret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

export async function generateBackupCodes(masterSecret: string, count = 8): Promise<{
  codes: string[];
  hashes: string[];
}> {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.getRandomValues(new Uint8Array(5));
    const code = Array.from(raw)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const formatted = `${code.slice(0, 5)}-${code.slice(5, 10)}`;
    codes.push(formatted);
    hashes.push(await sha256Hex(`${masterSecret}:${formatted}`));
  }
  return { codes, hashes };
}

export async function consumeBackupCode(
  inputCode: string,
  hashesJson: string,
  masterSecret: string,
): Promise<{ matched: boolean; remainingJson: string }> {
  const normalized = inputCode.trim().toUpperCase();
  let hashes: string[] = [];
  try {
    const parsed = JSON.parse(hashesJson);
    if (Array.isArray(parsed)) hashes = parsed;
  } catch {
    return { matched: false, remainingJson: hashesJson };
  }

  const candidateHash = await sha256Hex(`${masterSecret}:${normalized}`);
  const idx = hashes.findIndex((h) => timingSafeEqualStrings(h, candidateHash));
  if (idx === -1) return { matched: false, remainingJson: hashesJson };

  const updated = hashes.filter((_, i) => i !== idx);
  return { matched: true, remainingJson: JSON.stringify(updated) };
}

export async function signPreviewToken(
  payload: { pageId?: string; slug?: string; adminId: string; includeBrandDraft?: boolean },
  secret: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ ...payload, purpose: 'cms_preview' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .setIssuer('deynold-danny-preview')
    .sign(key);
}

export async function verifyPreviewToken(
  token: string,
  secret: string,
): Promise<{ pageId?: string; slug?: string; adminId: string; includeBrandDraft?: boolean } | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { issuer: 'deynold-danny-preview' });
    if (payload.purpose !== 'cms_preview') return null;
    return payload as { pageId?: string; slug?: string; adminId: string; includeBrandDraft?: boolean };
  } catch {
    return null;
  }
}
