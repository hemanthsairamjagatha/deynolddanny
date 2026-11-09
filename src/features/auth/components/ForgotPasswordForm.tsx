import React, { useState } from 'react';

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid client email address.');
      return;
    }

    setIsLoading(true);

    // Simulate recovery email dispatch
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 750);
  };

  return (
    <div className="w-full max-w-md bg-white border border-neutral-200/80 shadow-sm p-8 sm:p-10 rounded-sm">
      {/* Editorial Header */}
      <div className="text-center pb-8 border-b border-neutral-100">
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Security Assistance
        </span>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900 font-serif">
          Reset Password
        </h1>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          Enter the email address registered with your DEYNOLD DANNY profile. We will dispatch an encrypted reset link.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 p-3.5 bg-red-50/80 border border-red-200 text-red-700 text-xs rounded-sm animate-in fade-in duration-200"
        >
          {errorMessage}
        </div>
      )}

      {!isSubmitted ? (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="forgot-email"
              className="block text-xs uppercase tracking-wider font-medium text-neutral-800 font-mono"
            >
              Email Address <span className="text-neutral-400">*</span>
            </label>
            <input
              id="forgot-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@deynolddanny.com"
              className="w-full h-12 px-4 bg-[#faf8f5] border border-neutral-300 text-neutral-900 text-xs tracking-wide rounded-sm focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors"
            />
          </div>

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
                DISPATCHING...
              </span>
            ) : (
              'SEND RECOVERY LINK'
            )}
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-6 text-center animate-in fade-in duration-300">
          <div className="p-5 bg-[#faf8f5] border border-neutral-200/80 rounded-sm">
            <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-wider mb-1">
              Instructions Dispatched
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              If an account is associated with <span className="font-semibold text-neutral-900">{email}</span>, you will receive an email with reset instructions shortly.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href="/account/sign-in"
              className="w-full h-12 rounded-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-all shadow-sm flex items-center justify-center"
            >
              Return to Sign In
            </a>

            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="text-xs text-neutral-500 hover:text-black uppercase tracking-wider py-1 font-mono transition-colors"
            >
              Re-enter email address
            </button>
          </div>
        </div>
      )}

      {/* Back to Sign In Link */}
      {!isSubmitted && (
        <div className="mt-8 pt-6 border-t border-neutral-100 text-center text-xs text-neutral-600">
          <span>Remember your password? </span>
          <a
            href="/account/sign-in"
            className="font-medium text-neutral-900 underline underline-offset-4 hover:text-black transition-colors"
          >
            Sign In
          </a>
        </div>
      )}
    </div>
  );
};

