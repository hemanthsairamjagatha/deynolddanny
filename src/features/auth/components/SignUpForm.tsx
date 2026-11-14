import React, { useState, useEffect } from 'react';
import type { SignUpData } from '../types/auth.types';
import { sendOtpApi, verifyOtpApi, logoutApi } from '../api/auth.api';
import { apiFetch, getStoredClientEmail, getAccessToken } from '../../../lib/api/client';

export const SignUpForm: React.FC = () => {
  const [formData, setFormData] = useState<SignUpData>({
    title: 'Mr.',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    newsletterConsent: true
  });

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredClientEmail();
    const token = getAccessToken();
    if (stored && (token || true)) {
      setCurrentEmail(stored);
    }
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    setCurrentEmail(null);
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters in length.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both entries.');
      return;
    }

    if (!formData.acceptTerms) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to proceed.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await sendOtpApi(formData.email);
      setIsLoading(false);
      if (res.success) {
        setStep('otp');
        setSuccessMessage(`A 6-digit verification code has been dispatched to ${formData.email}.`);
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
      const res = await verifyOtpApi(formData.email, otp);
      if (res.success && res.data) {
        // Update user's full name in D1 database
        const fullName = `${formData.title} ${formData.firstName} ${formData.lastName}`.trim();
        await apiFetch('/api/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ fullName })
        }).catch(() => {});

        // Optional newsletter subscription
        if (formData.newsletterConsent) {
          await apiFetch('/api/newsletter/subscribe', {
            method: 'POST',
            body: JSON.stringify({ email: formData.email })
          }).catch(() => {});
        }

        setIsLoading(false);
        setSuccessMessage('Client profile created successfully. Welcome to DEYNOLD DANNY.');
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
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
      <div className="w-full max-w-lg bg-white border border-neutral-200/80 shadow-sm p-8 sm:p-10 rounded-sm text-center">
        <div className="w-14 h-14 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Private Client Active
        </span>
        <h1 className="text-2xl sm:text-3xl font-light text-neutral-900 font-serif mb-2">
          Profile Already Active
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
    <div className="w-full max-w-lg bg-white border border-neutral-200/80 shadow-sm p-8 sm:p-10 rounded-sm">
      {/* Editorial Header */}
      <div className="text-center pb-8 border-b border-neutral-100">
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Client Registration
        </span>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900 font-serif">
          {step === 'details' ? 'Create Your Profile' : 'Verify Email'}
        </h1>
        {step !== 'details' && (
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed max-w-sm mx-auto">
            Enter the 6-digit verification code dispatched to {formData.email}.
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

      {/* Form: Step 1 Details */}
      {step === 'details' ? (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          {/* Title Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono">
              Title
            </label>
            <div className="flex gap-2">
              {['Mr.', 'Mrs.', 'Ms.', 'Mx.'].map((titleOption) => (
                <button
                  key={titleOption}
                  type="button"
                  onClick={() => setFormData({ ...formData, title: titleOption })}
                  className={`py-2 px-3.5 text-xs font-mono rounded-sm border transition-colors ${
                    formData.title === titleOption
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-[#faf8f5] text-neutral-700 hover:border-neutral-400'
                  }`}
                >
                  {titleOption}
                </button>
              ))}
            </div>
          </div>

          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="signup-firstname"
                className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
              >
                First Name <span className="text-neutral-400">*</span>
              </label>
              <input
                id="signup-firstname"
                type="text"
                name="given-name"
                autoComplete="given-name"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Julian"
                className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-lastname"
                className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
              >
                Last Name <span className="text-neutral-400">*</span>
              </label>
              <input
                id="signup-lastname"
                type="text"
                name="family-name"
                autoComplete="family-name"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Vanderbilt"
                className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label
              htmlFor="signup-email"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              Email Address <span className="text-neutral-400">*</span>
            </label>
            <input
              id="signup-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@deynolddanny.com"
              className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="signup-password"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              Password <span className="text-neutral-400">*</span>
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                name="new-password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="At least 8 characters"
                className="w-full h-12 px-4 pr-11 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors p-1"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="signup-confirmpassword"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              Confirm Password <span className="text-neutral-400">*</span>
            </label>
            <input
              id="signup-confirmpassword"
              type={showPassword ? 'text' : 'password'}
              name="confirm-password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Repeat password"
              className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
          </div>

          {/* Legal Consent Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-600 leading-relaxed select-none">
              <input
                type="checkbox"
                required
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-900 accent-neutral-900 flex-shrink-0"
              />
              <span>
                I accept the{' '}
                <a href="/legal/terms" className="text-neutral-900 underline underline-offset-2 hover:text-black">
                  Terms of Service
                </a>{' '}
                and confirm I have read the{' '}
                <a href="/legal/privacy-policy" className="text-neutral-900 underline underline-offset-2 hover:text-black">
                  Privacy Policy
                </a>
                . <span className="text-neutral-400">*</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-600 leading-relaxed select-none">
              <input
                type="checkbox"
                checked={formData.newsletterConsent}
                onChange={(e) => setFormData({ ...formData, newsletterConsent: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-900 accent-neutral-900 flex-shrink-0"
              />
              <span>
                Receive discreet atelier correspondence, private exhibition invitations, and new collection previews.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-75 mt-6"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                CREATING PROFILE...
              </span>
            ) : (
              'CREATE CLIENT ACCOUNT'
            )}
          </button>
        </form>
      ) : (
        /* Form: Step 2 OTP Verification */
        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="signup-otp"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              6-Digit Verification Code <span className="text-neutral-400">*</span>
            </label>
            <input
              id="signup-otp"
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
              'VERIFY & COMPLETE REGISTRATION'
            )}
          </button>

          <div className="flex justify-between items-center text-[11px] font-mono text-neutral-500 pt-2">
            <button
              type="button"
              onClick={() => {
                setStep('details');
                setOtp('');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="underline underline-offset-4 hover:text-black transition-colors"
            >
              Edit Details
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="underline underline-offset-4 hover:text-black transition-colors"
            >
              Resend Code
            </button>
          </div>
        </form>
      )}

      {/* Switch to Sign In */}
      <div className="mt-8 pt-6 border-t border-neutral-100 text-center text-xs text-neutral-600">
        <span>Already have an account? </span>
        <a
          href="/account/sign-in"
          className="font-medium text-neutral-900 underline underline-offset-4 hover:text-black transition-colors"
        >
          Sign In
        </a>
      </div>
    </div>
  );
};
