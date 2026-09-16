'use client';

/**
 * Bug #3 — merchant password reset, step 1: request the link.
 *
 * Single-step page: enter your email, we email a reset link, done. The link
 * lands on /merchant/reset-password?token=... which is where the new password
 * is set. Backend is silent for unknown/unverified emails so this page can't
 * be used to probe whether an account exists.
 */

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { MailCheck, Stamp } from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { Button } from '@stamposa/ui/components/button';
import { Field, Input } from '@/components/ui/field';
import { AuroraBackdrop, GridPattern, auroraStyles } from '@/components/auth/aurora-visuals';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await merchantApi.auth.forgotPassword(trimmed);
      setSent(trimmed);
      toast.success('If an account exists, a reset link is on its way.');
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />

      {/* Header — logo only. Back-to-sign-in link sits below the card. */}
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

            {sent ? (
              <div className="mt-3">
                <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                  <MailCheck className="size-5" strokeWidth={2} />
                </div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                  Check your email
                </h1>
                <p className="mt-3 text-sm text-white/70">
                  If an account exists for{' '}
                  <span className="font-medium text-white">{sent}</span>, we&rsquo;ve sent you a
                  link to reset your password. The link expires in 30 minutes.
                </p>
                <p className="mt-4 text-[13px] text-white/60">
                  Didn&rsquo;t get it? Check your spam folder, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSent(null);
                      setError(null);
                    }}
                    className="font-medium text-amber-300 hover:text-amber-200"
                  >
                    try a different email
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                  Reset your password
                </h1>
                <p className="mt-1.5 text-sm text-white/60">
                  Enter the email you signed up with. We&rsquo;ll send you a link to choose a new
                  password.
                </p>

                <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
                  <Field label="Email" error={error ?? undefined}>
                    {(p) => (
                      <Input
                        {...p}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                      />
                    )}
                  </Field>
                  <Button type="submit" size="lg" className="w-full" loading={busy} variant="brand">
                    Send reset link
                  </Button>
                </form>
              </div>
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
