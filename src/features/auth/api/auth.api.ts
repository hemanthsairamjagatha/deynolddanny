/**
 * src/features/auth/api/auth.api.ts
 *
 * Authentication API operations connecting the storefront to the Cloudflare Worker OTP engine.
 */

import { apiFetch, setAccessToken, setStoredClientEmail } from '../../../lib/api/client';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role?: string;
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
 * Verify OTP and sign in
 */
export async function verifyOtpApi(email: string, otp: string) {
  const cleanEmail = email.trim().toLowerCase();
  const res = await apiFetch<VerifyOtpResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: cleanEmail, otp: otp.trim() }),
  });

  if (res.success && res.data?.accessToken) {
    setAccessToken(res.data.accessToken);
    setStoredClientEmail(res.data.user?.email || cleanEmail);
  }

  return res;
}

/**
 * Get current authenticated user profile
 */
export async function getProfileApi() {
  return apiFetch<UserProfile>('/api/users/profile');
}

/**
 * Log out user
 */
export async function logoutApi() {
  const res = await apiFetch('/api/auth/logout', { method: 'POST' });
  setAccessToken(null);
  setStoredClientEmail(null);
  return res;
}

