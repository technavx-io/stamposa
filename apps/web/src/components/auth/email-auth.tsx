'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { merchantApi, staffApi } from '@/lib/api/endpoints';
import type { AuthSession } from '@/lib/api/types';
import { sessionFor } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/field';

type Role = 'MERCHANT' | 'STAFF';
type Mode = 'login' | 'signup';

export interface EmailAuthProps {
  role: Role;
  /** Merchants can self-register; staff accounts are created by the owner. */
  allowSignup: boolean;
  onAuthenticated: (session: AuthSession) => void;
}

export function EmailAuth({ role, allowSignup, onAuthenticated }: EmailAuthProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Email-verification step (merchant signup). Non-null email = show it.
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [resendIn, setResendIn] = useState(0);

  const isSignup = allowSignup && mode === 'signup';

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const finish = (session: AuthSession) => {
    sessionFor(role).set({ tokens: session.tokens, actor: session.actor });
    toast.success(`Welcome${session.actor.name ? `, ${session.actor.name.split(' ')[0]}` : ''}!`);
    onAuthenticated(session);
  };

  const enterVerification = (info: { email: string; resendInSec: number; devCode?: string }) => {
    setVerifyingEmail(info.email);
    setDevCode(info.devCode);
    setResendIn(info.resendInSec);
    setCode('');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isSignup && name.trim().length < 2) {
      setError('Enter your name (at least 2 characters).');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (isSignup) {
        const requested = await merchantApi.auth.signup(email.trim(), password, name.trim());
        enterVerification(requested);
      } else if (role === 'MERCHANT') {
        finish(await merchantApi.auth.login(email.trim(), password));
      } else {
        finish(await staffApi.auth.login(email.trim(), password));
      }
    } catch (err) {
      // An unverified merchant tried to sign in — send them to verify instead.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        try {
          const r = await merchantApi.auth.resendEmailVerification(email.trim());
          enterVerification({ email: email.trim(), resendInSec: r.resendInSec, devCode: r.devCode });
        } catch {
          enterVerification({ email: email.trim(), resendInSec: 0 });
        }
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Check your connection and try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const verifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    try {
      finish(await merchantApi.auth.verifyEmail(verifyingEmail!, code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0 || !verifyingEmail) return;
    try {
      const r = await merchantApi.auth.resendEmailVerification(verifyingEmail);
      setDevCode(r.devCode);
      setResendIn(r.resendInSec);
      toast.success('A new code is on its way.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resend the code.');
    }
  };

  // ── Verification step ────────────────────────────────────────────────
  if (verifyingEmail) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-strong">Check your email</h1>
          <p className="mt-1 text-sm text-muted">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-body">{verifyingEmail}</span>. Enter it to finish
            setting up your account.
          </p>
        </div>

        {devCode && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            No email set up yet — your code is{' '}
            <button
              type="button"
              onClick={() => setCode(devCode)}
              className="font-mono font-semibold underline underline-offset-2"
            >
              {devCode}
            </button>
          </p>
        )}

        <form className="space-y-4" onSubmit={verifySubmit}>
          <Field label="Verification code" error={error ?? undefined}>
            {(p) => (
              <Input
                {...p}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                className="text-center font-mono text-lg tracking-[0.4em]"
              />
            )}
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={busy} variant="brand">
            Verify &amp; continue
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[13px]">
          <button
            type="button"
            onClick={() => {
              setVerifyingEmail(null);
              setError(null);
            }}
            className="text-muted transition-colors hover:text-strong"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resendIn > 0}
            className="font-medium text-brand-600 transition-colors hover:text-brand-700 disabled:text-muted disabled:hover:text-muted"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  // ── Login / signup ───────────────────────────────────────────────────
  return (
    <div className="w-full">
      {allowSignup && (
        <div className="mb-6 inline-flex rounded-lg border border-line bg-canvas p-0.5 text-sm">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
                mode === m ? 'bg-surface text-strong shadow-sm' : 'text-muted hover:text-strong'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      {!allowSignup && (
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-strong">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Use the email and password your manager set for you.
          </p>
        </div>
      )}

      <form className="space-y-4" onSubmit={submit}>
        {isSignup && (
          <Field label="Your full name">
            {(p) => (
              <Input
                {...p}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Patel"
                autoComplete="name"
                autoFocus
                required
              />
            )}
          </Field>
        )}

        <Field label="Email">
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus={!isSignup}
              required
            />
          )}
        </Field>

        <Field label="Password" error={error ?? undefined}>
          {(p) => (
            <PasswordInput
              {...p}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
            />
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={busy} variant="brand">
          {isSignup ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      {isSignup && (
        <p className="mt-4 text-[13px] text-muted">
          We&rsquo;ll email you a 6-digit code to confirm your address before you get in.
        </p>
      )}
    </div>
  );
}
