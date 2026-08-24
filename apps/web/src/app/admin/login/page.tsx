'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertCircle, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin-client';
import type { AdminSession, TwoFactorSetup } from '@/lib/api/admin-types';
import { adminSession, useAdminSession } from '@/lib/admin/admin-session';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';

type Step = 'credentials' | 'setup' | 'verify' | 'recovery';

export default function AdminLoginPage() {
  const router = useRouter();
  const { session, ready } = useAdminSession();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingSession, setPendingSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace('/admin');
  }, [ready, session, router]);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await adminApi.login(email, password);
      // Two-factor disabled by configuration — the API hands back a session.
      if (result.status === 'AUTHENTICATED') {
        finish(result);
        return;
      }
      setTwoFactorToken(result.twoFactorToken);
      if (result.status === 'TWO_FACTOR_SETUP_REQUIRED' && result.twoFactorSetup) {
        setSetup(result.twoFactorSetup);
        setStep('setup');
      } else {
        setStep('verify');
      }
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value: string) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result =
        step === 'setup'
          ? await adminApi.enrollTwoFactor(twoFactorToken, value)
          : await adminApi.verifyTwoFactor(twoFactorToken, value);

      if (result.recoveryCodes?.length) {
        // Shown exactly once — hold the session until they're acknowledged.
        setRecoveryCodes(result.recoveryCodes);
        setPendingSession(result);
        setStep('recovery');
        return;
      }
      finish(result);
    } catch (err) {
      setCode('');
      setError(err instanceof ApiError ? err.message : 'Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const finish = (result: AdminSession) => {
    adminSession.set({ tokens: result.tokens, admin: result.admin });
    toast.success(`Signed in as ${result.admin.name}`);
    router.replace('/admin');
  };

  if (!ready || session) return null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-white/10">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Stamposa Platform</p>
            <p className="font-mono text-[11px] tracking-wider text-slate-500 uppercase">
              Operator console
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900 p-7 shadow-2xl">
          {step === 'credentials' && (
            <form onSubmit={submitCredentials} className="space-y-5">
              <div>
                <h1 className="text-lg font-semibold text-white">Sign in</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Platform staff only. Every action here is recorded.
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500/30"
                  placeholder="owner@stamposa.com"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500/30"
                  placeholder="••••••••••••"
                />
              </div>
              {error && <ErrorNote message={error} />}
              <Button type="submit" size="lg" variant="brand" className="w-full" loading={busy}>
                Continue
              </Button>
            </form>
          )}

          {step === 'setup' && setup && (
            <div className="space-y-5">
              <div>
                <h1 className="text-lg font-semibold text-white">Set up two-factor</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Admin accounts require an authenticator app. Scan this once, then enter the code
                  it shows.
                </p>
              </div>
              <div className="flex justify-center rounded-lg bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from our API */}
                <img src={setup.qrDataUrl} alt="Two-factor setup QR code" className="size-44" />
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(setup.secret);
                  toast.success('Secret copied');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-500 transition-colors hover:text-slate-200"
              >
                <Copy className="size-3.5" /> {setup.secret}
              </button>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Enter the 6-digit code</p>
                <OtpInput value={code} onChange={setCode} onComplete={submitCode} disabled={busy} />
              </div>
              {error && <ErrorNote message={error} />}
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-lg font-semibold text-white">Two-factor code</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Open your authenticator app and enter the current code.
                </p>
              </div>
              <OtpInput value={code} onChange={setCode} onComplete={submitCode} disabled={busy} />
              {error && <ErrorNote message={error} />}
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setCode('');
                  setError(null);
                }}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                <KeyRound className="size-3.5" /> Use a recovery code instead — paste it above
              </button>
            </div>
          )}

          {step === 'recovery' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-lg font-semibold text-white">Save your recovery codes</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Each code works once, if you ever lose your authenticator. This is the only time
                  they are shown.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-slate-950 p-4">
                {recoveryCodes.map((c) => (
                  <code key={c} className="font-mono text-sm tracking-wider text-slate-200">
                    {c}
                  </code>
                ))}
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(recoveryCodes.join('\n'));
                  toast.success('Recovery codes copied');
                }}
              >
                <Copy className="size-4" /> Copy all
              </Button>
              <Button
                variant="brand"
                size="lg"
                className="w-full"
                onClick={() => pendingSession && finish(pendingSession)}
              >
                I&apos;ve saved them — continue
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Merchant or staff?{' '}
          <a href="/merchant/login" className="text-slate-500 underline-offset-2 hover:underline">
            Sign in there instead
          </a>
        </p>
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}
