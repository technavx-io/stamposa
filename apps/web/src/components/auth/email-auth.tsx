'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { merchantApi, staffApi } from '@/lib/api/endpoints';
import type { AuthSession } from '@/lib/api/types';
import { sessionFor } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

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

  const isSignup = allowSignup && mode === 'signup';

  const finish = (session: AuthSession) => {
    sessionFor(role).set({ tokens: session.tokens, actor: session.actor });
    toast.success(`Welcome${session.actor.name ? `, ${session.actor.name.split(' ')[0]}` : ''}!`);
    onAuthenticated(session);
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
      const session = isSignup
        ? await merchantApi.auth.signup(email.trim(), password, name.trim())
        : role === 'MERCHANT'
          ? await merchantApi.auth.login(email.trim(), password)
          : await staffApi.auth.login(email.trim(), password);
      finish(session);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

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
            <Input
              {...p}
              type="password"
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
    </div>
  );
}
