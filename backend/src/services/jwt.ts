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
  sub: string;    // userId
  email: string;
  role: string;
}

/**
 * Signs a short-lived HS256 access token (15 minutes).
 */
export async function signAccessToken(payload: JwtPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sub: payload.sub, email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('deynold-danny')
    .sign(key);
}

/**
 * Verifies an access token and returns the decoded payload.
 * Throws on invalid/expired tokens — callers must catch.
 */
export async function verifyAccessToken(token: string, secret: string): Promise<JwtPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { issuer: 'deynold-danny' });
  return payload as unknown as JwtPayload;
}

/**
 * Sets an HttpOnly Secure SameSite=None refresh-token cookie (cross-origin compatible).
 */
export function setRefreshCookie(c: Context<{ Bindings: Env }>, token: string): void {
  c.header(
    'Set-Cookie',
    [
      `${COOKIE_REFRESH_TOKEN}=${token}`,
      'HttpOnly',
      'Secure',
      'SameSite=None',
      `Max-Age=${REFRESH_TOKEN_EXPIRY_SECONDS}`,
      `Path=${COOKIE_PATH}`,
    ].join('; '),
  );
}

/**
 * Clears the refresh-token cookie by setting Max-Age=0.
 */
export function clearRefreshCookie(c: Context<{ Bindings: Env }>): void {
  c.header(
    'Set-Cookie',
    [
      `${COOKIE_REFRESH_TOKEN}=`,
      'HttpOnly',
      'Secure',
      'SameSite=None',
      'Max-Age=0',
      `Path=${COOKIE_PATH}`,
    ].join('; '),
  );
}

/**
 * Extracts the refresh token value from the Cookie header.
 * Returns null if not present.
 */
export function getRefreshTokenFromCookie(c: Context): string | null {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_REFRESH_TOKEN}=([^;]+)`));
  return match?.[1] ?? null;
}
