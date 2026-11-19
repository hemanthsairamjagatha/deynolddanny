import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth as authApi } from '../../lib/api';
import { Button, Input } from '../../components/ui';

type Step = 'email' | 'otp' | 'mfa';

export default function SignInPage() {
  const { login, verifyMfa, mfaRequired } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(mfaRequired ? 'mfa' : 'email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.requestOtp(email);
      setStep('otp');
    } catch {
      setError('Failed to send code. Check your email address and try again.');
    } finally { setLoading(false); }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, otp);
      if (res.mfaRequired) { setStep('mfa'); return; }
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyMfa(mfaCode);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid authenticator code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-50 to-ink-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-ink-900 rounded-2xl mb-5 shadow-lg">
            <span className="text-gold-400 font-display font-bold text-2xl">D</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-ink-900 tracking-tight">Commerce OS</h1>
          <p className="text-sm text-ink-500 mt-1.5">Deynold Danny Administration</p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-200 shadow-sm overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-gold-400 to-gold-600" />
          <div className="p-7">
            {step === 'email' && (
              <form onSubmit={requestOtp} className="space-y-5">
                <div>
                  <h2 className="text-lg font-display font-semibold text-ink-900">Sign in to your account</h2>
                  <p className="text-sm text-ink-500 mt-1">Enter your admin email to receive a secure sign-in code.</p>
                </div>
                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">{error}</div>}
                <Input label="Admin email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@deynolddanny.com" required autoFocus autoComplete="email" />
                <Button type="submit" loading={loading} className="w-full justify-center" size="lg">Send Sign-in Code</Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={submitOtp} className="space-y-5">
                <div>
                  <h2 className="text-lg font-display font-semibold text-ink-900">Check your email</h2>
                  <p className="text-sm text-ink-500 mt-1">We sent a 6-digit code to <span className="font-medium text-ink-700">{email}</span></p>
                </div>
                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">{error}</div>}
                <Input label="One-time code" type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" maxLength={6} required autoFocus inputMode="numeric" className="text-center tracking-widest text-xl font-mono" />
                <Button type="submit" loading={loading} className="w-full justify-center" size="lg">Continue</Button>
                <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }} className="w-full text-sm text-ink-500 hover:text-ink-900 transition-colors py-1">← Use a different email</button>
              </form>
            )}

            {step === 'mfa' && (
              <form onSubmit={submitMfa} className="space-y-5">
                <div>
                  <h2 className="text-lg font-display font-semibold text-ink-900">Two-factor authentication</h2>
                  <p className="text-sm text-ink-500 mt-1">Enter the 6-digit code from your authenticator app.</p>
                </div>
                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">{error}</div>}
                <Input label="Authenticator code" type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value)} placeholder="000000" maxLength={6} required autoFocus inputMode="numeric" className="text-center tracking-widest text-xl font-mono" />
                <Button type="submit" loading={loading} className="w-full justify-center" size="lg">Verify Identity</Button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-ink-400 mt-6">Secure admin access · Deynold Danny · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
