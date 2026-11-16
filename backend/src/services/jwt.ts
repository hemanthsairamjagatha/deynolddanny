import { SignJWT, jwtVerify } from 'jose';
import type { Context } from 'hono';
import type { Env } from '../types/bindings.js';
import {
  ACCESS_TOKEN_EXPIRY,
  COOKIE_REFRESH_TOKEN,
  COOKIE_PATH,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '../config/constants.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  ver?: number;
}

/**
 * Signs a short-lived HS256 access token (15 minutes).
 */
export async function signAccessToken(payload: JwtPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    ver: payload.ver ?? 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('deynold-danny')
    .sign(key);
}

/**
 * Verifies an access token against primary JWT_SECRET and optional rotation secret JWT_SECRET_PREV.
 * Throws on invalid/expired tokens.
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
  prevSecret?: string,
): Promise<JwtPayload> {
  const key = new TextEncoder().encode(secret);
  try {
    const { payload } = await jwtVerify(token, key, { issuer: 'deynold-danny' });
    return payload as unknown as JwtPayload;
  } catch (err) {
    if (prevSecret && prevSecret.length >= 16) {
      const prevKey = new TextEncoder().encode(prevSecret);
      const { payload } = await jwtVerify(token, prevKey, { issuer: 'deynold-danny' });
      return payload as unknown as JwtPayload;
    }
    throw err;
  }
}

function buildCookieAttributes(c: Context<{ Bindings: Env }>, maxAge: number): string[] {
  const reqUrl = new URL(c.req.url);
  const isHttps =
    reqUrl.protocol === 'https:' ||
    c.req.header('x-forwarded-proto') === 'https';

  const originHeader = c.req.header('Origin');
  let isCrossSite = false;
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host;
      isCrossSite = originHost !== reqUrl.host;
    } catch {
      isCrossSite = true;
    }
  }

  const attrs = ['HttpOnly', `Max-Age=${maxAge}`, `Path=${COOKIE_PATH}`];

  if (isHttps) {
    attrs.push('Secure');
    attrs.push(isCrossSite ? 'SameSite=None' : 'SameSite=Lax');
  } else {
    // Local plain-HTTP dev: SameSite=Lax without Secure so http://localhost preserves cookies
    attrs.push('SameSite=Lax');
  }

  return attrs;
}

/**
 * Sets an HttpOnly refresh-token cookie compatible with both same-origin BFF proxy (SameSite=Lax)
 * and explicit cross-origin HTTPS admin dashboards (SameSite=None; Secure).
 */
export function setRefreshCookie(c: Context<{ Bindings: Env }>, token: string): void {
  const attrs = buildCookieAttributes(c, REFRESH_TOKEN_EXPIRY_SECONDS);
  c.header('Set-Cookie', [`${COOKIE_REFRESH_TOKEN}=${token}`, ...attrs].join('; '));
}

/**
 * Clears the refresh-token cookie by setting Max-Age=0.
 */
export function clearRefreshCookie(c: Context<{ Bindings: Env }>): void {
  const attrs = buildCookieAttributes(c, 0);
  c.header('Set-Cookie', [`${COOKIE_REFRESH_TOKEN}=`, ...attrs].join('; '));
}

/**
 * Extracts the refresh token value from the Cookie header.
 */
export function getRefreshTokenFromCookie(c: Context): string | null {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_REFRESH_TOKEN}=([^;]+)`));
  return match?.[1] ?? null;
}
