import React, { useState } from 'react';
import type { SignInCredentials } from '../types/auth.types';

export const SignInForm: React.FC = () => {
  const [credentials, setCredentials] = useState<SignInCredentials>({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validation
    if (!credentials.email.trim() || !credentials.password) {
      setErrorMessage('Please provide both your email address and password.');
      return;
    }

    if (!credentials.email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    // Simulate luxury authentication response
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Identification verified. Welcome back to DEYNOLD DANNY.');
      // In SSR/BFF, form would post to API or redirect to account dashboard
      setTimeout(() => {
        window.location.href = '/';
      }, 1200);
    }, 800);
  };

  return (
    <div className="w-full max-w-md bg-white border border-neutral-200/80 shadow-sm p-8 sm:p-10 rounded-sm">
      {/* Editorial Header */}
      <div className="text-center pb-8 border-b border-neutral-100">
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Client Identification
        </span>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900 font-serif">
          Sign In
        </h1>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          Access your private wardrobe, orders, and personalized tailoring recommendations.
        </p>
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
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

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="signin-password"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              Password <span className="text-neutral-400">*</span>
            </label>
            <a
              href="/account/forgot-password"
              className="text-[11px] text-neutral-500 hover:text-black underline underline-offset-4 transition-colors font-mono"
            >
              Forgot Password?
            </a>
          </div>

          <div className="relative">
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="••••••••••••"
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

        {/* Remember Me Checkbox */}
        <div className="flex items-center">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-600 select-none">
            <input
              type="checkbox"
              checked={credentials.rememberMe}
              onChange={(e) => setCredentials({ ...credentials, rememberMe: e.target.checked })}
              className="w-4 h-4 rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-900 accent-neutral-900"
            />
            <span>Remember my client profile on this device</span>
          </label>
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
              VERIFYING...
            </span>
          ) : (
            'SIGN IN'
          )}
        </button>
      </form>

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

