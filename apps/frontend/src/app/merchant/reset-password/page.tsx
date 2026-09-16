'use client';

/**
 * Bug #3 — merchant password reset, step 2: land from the emailed link and
 * set the new password.
 *
 * The reset token comes in via ?token=... in the URL. We deliberately do NOT
 * pre-verify the token — a GET hitting the backend would consume it (tokens
 * are single-use), so a preview-link scanner in the user's mail provider
 * would burn the token before the user ever sees the form. The token is only
 * consumed when they submit their new password.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, KeyRound, Stamp } from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { Button } from '@stamposa/ui/components/button';
import { Field, PasswordInput } from '@/components/ui/field';
import { AuroraBackdrop, GridPattern, auroraStyles } from '@/components/auth/aurora-visuals';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { sessionFor } from '@/lib/auth/session';

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token || token.length < 32) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const session = await merchantApi.auth.resetPassword(token, newPassword);
      sessionFor('MERCHANT').set({ tokens: session.tokens, actor: session.actor });
      toast.success('Password reset. You are signed in.');
      router.replace(session.business ? '/merchant/dashboard' : '/merchant/onboarding');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not reset the password. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const missingToken = !token;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />

      <header className="relative z-20 mx-auto flex h-16 w-full max-w-6xl items-center px-6 sm:px-10">
        <Link
          href={siteHref('/')}
          className="flex items-center gap-2 font-semibold tracking-tight text-white"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-500/30">
            <Stamp className="size-4" />
          </span>
          Stamposa
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
        <section className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              Merchant portal
            </p>

            <div className="mt-3">
              <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                <KeyRound className="size-5" strokeWidth={2} />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                Choose a new password
              </h1>
              <p className="mt-1.5 text-sm text-white/60">
                You&rsquo;ll be signed in as soon as you set your new password.
              </p>
            </div>

            {missingToken ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p>
                  This reset link is missing its token. Open the link from your email again, or{' '}
                  <Link
                    href="/merchant/forgot-password"
                    className="font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
                  >
                    request a new one
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
                <Field label="New password">
                  {(p) => (
                    <PasswordInput
                      {...p}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      autoFocus
                    />
                  )}
                </Field>
                <Field label="Confirm new password" error={error ?? undefined}>
                  {(p) => (
                    <PasswordInput
                      {...p}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Type it again"
                      autoComplete="new-password"
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={busy} variant="brand">
                  Set new password &amp; sign in
                </Button>
              </form>
            )}
          </div>

          <p className="mt-4 text-center text-sm text-white/70">
            Remembered it?{' '}
            <Link
              href="/merchant/login"
              className="font-medium text-amber-300 hover:text-amber-200"
            >
              Back to sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
