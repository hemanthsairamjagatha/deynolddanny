import React, { useState, useEffect } from 'react';
import type { SignInCredentials } from '../types/auth.types';
import { sendOtpApi, verifyOtpApi, logoutApi } from '../api/auth.api';
import {
  getStoredClientEmail,
  getSessionId,
  hasSessionHint,
  ensureAuthenticatedSession,
} from '../../../lib/api/client';
import { mergeCartApi } from '../../cart/api/cart.api';
import { syncCartWithBackend } from '../../cart/store/cart.store';
import { syncWishlistWithBackend } from '../../wishlist/store/wishlist.store';

function getSafeRedirectTarget(): string {
  if (typeof window === 'undefined') return '/account';
  try {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('redirect') || params.get('next') || '';
    if (next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
      return next;
    }
  } catch {
    // ignore malformed query string
  }
  return '/account';
}

export const SignInForm: React.FC = () => {
  const [credentials, setCredentials] = useState<SignInCredentials>({
    email: '',
    rememberMe: true
  });
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const stored = getStoredClientEmail();
    if (!hasSessionHint()) return;
    ensureAuthenticatedSession().then((token) => {
      if (!active) return;
      if (token) {
        setCurrentEmail(getStoredClientEmail() || stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    setCurrentEmail(null);
    window.location.reload();
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!credentials.email.trim()) {
      setErrorMessage('Please provide your email address.');
      return;
    }

    if (!credentials.email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await sendOtpApi(credentials.email);
      setIsLoading(false);
      if (res.success) {
        setStep('otp');
        setSuccessMessage(`A 6-digit verification code has been dispatched to ${credentials.email}.`);
      } else {
        setErrorMessage(res.error?.message || 'Unable to dispatch verification code. Please try again.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Unable to reach server. Please check your connection and try again.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit code received in your email.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await verifyOtpApi(credentials.email, otp);
      if (res.success && res.data) {
        await mergeCartApi(getSessionId()).catch(() => {});
        await Promise.all([syncCartWithBackend(), syncWishlistWithBackend()]).catch(() => {});
        setIsLoading(false);
        setSuccessMessage('Identification verified. Welcome back to DEYNOLD DANNY.');
        const redirectTarget = getSafeRedirectTarget();
        setTimeout(() => {
          window.location.href = redirectTarget;
        }, 700);
      } else {
        setIsLoading(false);
        setErrorMessage(res.error?.message || 'Invalid or expired verification code. Please check and try again.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Verification failed. Please try again.');
    }
  };

  if (currentEmail) {
    return (
      <div className="w-full max-w-md bg-white border border-neutral-200/80 shadow-sm p-8 sm:p-10 rounded-sm text-center">
        <div className="w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Private Client Active
        </span>
        <h1 className="text-2xl sm:text-3xl font-light text-neutral-900 font-serif mb-2">
          Currently Signed In
        </h1>
        <p className="text-xs text-neutral-600 mb-6 font-mono">
          {currentEmail}
        </p>
        <div className="space-y-3">
          <a
            href="/account"
            className="w-full block py-3.5 bg-neutral-900 text-white uppercase text-xs tracking-widest font-medium hover:bg-black transition-all text-center"
          >
            Access Client Dashboard
          </a>
          <a
            href="/orders/track"
            className="w-full block py-3.5 border border-neutral-300 text-neutral-800 uppercase text-xs tracking-widest font-medium hover:border-black hover:text-black transition-all text-center"
          >
            Track Commissions
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-xs text-neutral-500 hover:text-red-600 transition-colors uppercase tracking-widest font-mono pt-3 block"
          >
            Sign Out / Switch Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border border-neutral-200/80 shadow-sm p-8 sm:p-10 rounded-sm">
      {/* Editorial Header */}
      <div className="text-center pb-8 border-b border-neutral-100">
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Client Identification
        </span>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900 font-serif">
          {step === 'credentials' ? 'Sign In' : 'Verify Code'}
        </h1>
        {step !== 'credentials' && (
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            Enter the 6-digit verification code dispatched to {credentials.email}.
          </p>
        )}
      </div>

      {/* Status Messages */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-6 p-3.5 bg-red-50/80 border border-red-200 text-red-700 text-xs rounded-sm animate-in fade-in duration-200"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mt-6 p-3.5 bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs rounded-sm animate-in fade-in duration-200"
        >
          {successMessage}
        </div>
      )}

      {/* Form: Step 1 Credentials */}
      {step === 'credentials' ? (
        <form onSubmit={handleRequestOtp} className="mt-8 space-y-6" noValidate>
          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="signin-email"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              Email Address <span className="text-neutral-400">*</span>
            </label>
            <input
              id="signin-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={credentials.email}
              onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
              placeholder="client@deynolddanny.com"
              className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
          </div>

          {/* Passwordless Security Notice */}
          <div className="p-3.5 bg-[#faf8f5] border border-neutral-200/80 text-[11px] text-neutral-600 rounded-sm leading-relaxed">
            For enhanced atelier security, client sessions use single-use 6-digit email verification codes with no static password required.
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-75"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                SENDING VERIFICATION...
              </span>
            ) : (
              'CONTINUE WITH SECURE CODE'
            )}
          </button>
        </form>
      ) : (
        /* Form: Step 2 OTP Verification */
        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="signin-otp"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              6-Digit Verification Code <span className="text-neutral-400">*</span>
            </label>
            <input
              id="signin-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-center tracking-[0.5em] text-lg font-mono rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full h-12 rounded-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                VERIFYING...
              </span>
            ) : (
              'VERIFY & SIGN IN'
            )}
          </button>

          <div className="flex justify-between items-center text-[11px] font-mono text-neutral-500 pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setOtp('');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="underline underline-offset-4 hover:text-black transition-colors"
            >
              Change Email
            </button>
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={isLoading}
              className="underline underline-offset-4 hover:text-black transition-colors"
            >
              Resend Code
            </button>
          </div>
        </form>
      )}

      {/* Switch to Sign Up */}
      <div className="mt-8 pt-6 border-t border-neutral-100 text-center text-xs text-neutral-600">
        <span>New to DEYNOLD DANNY? </span>
        <a
          href="/account/sign-up"
          className="font-medium text-neutral-900 underline underline-offset-4 hover:text-black transition-colors"
        >
          Create a Client Profile
        </a>
      </div>
    </div>
  );
};
