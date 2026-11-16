/**
 * src/features/auth/api/auth.api.ts
 * OTP authentication API calls interacting with the Hono backend via same-origin `/api/*`.
 */

import {
  apiFetch,
  clearClientSession,
  setAccessToken,
  setSessionHint,
  setStoredClientEmail,
} from '../../../lib/api/client';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role?: string;
  createdAt?: string;
}

export interface SendOtpResponse {
  email: string;
  expiresInSeconds: number;
  message: string;
}

export interface VerifyOtpResponse {
  user: UserProfile;
  accessToken: string;
}

/**
 * Send a 6-digit OTP to the user's email address
 */
export async function sendOtpApi(email: string) {
  return apiFetch<SendOtpResponse>('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

/**
 * Verify OTP and sign in (refresh token stored strictly in HttpOnly cookie by backend)
 */
export async function verifyOtpApi(email: string, otp: string) {
  const cleanEmail = email.trim().toLowerCase();
  const res = await apiFetch<VerifyOtpResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: cleanEmail, otp: otp.trim() }),
  });

  if (res.success && res.data?.accessToken) {
    setAccessToken(res.data.accessToken);
    setSessionHint(true);
    setStoredClientEmail(res.data.user?.email || cleanEmail);
  }

  return res;
}

/**
 * Retrieve currently signed-in patron profile
 */
export async function getProfileApi() {
  return apiFetch<UserProfile>('/api/users/me');
}

/**
 * Update signed-in patron profile
 */
export async function updateProfileApi(payload: { fullName?: string; phone?: string }) {
  return apiFetch<UserProfile>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Log out user & clear in-memory token / session cookie
 */
export async function logoutApi() {
  const res = await apiFetch('/api/auth/logout', { method: 'POST', skipAuthRefresh: true });
  clearClientSession();
  return res;
}
