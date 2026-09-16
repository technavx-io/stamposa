'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Stamp } from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { EmailAuth } from '@/components/auth/email-auth';
import {
  AuroraBackdrop,
  GridPattern,
  StampCardHero,
  auroraStyles,
} from '@/components/auth/aurora-visuals';
import { consumeSignedOutElsewhere } from '@/lib/auth/session';
import { useStoredSession } from '@/lib/auth/use-stored-session';

export default function StaffLoginPage() {
  const router = useRouter();
  const { session, ready } = useStoredSession('STAFF');

  useEffect(() => {
    if (ready && session) router.replace('/staff');
  }, [session, ready, router]);

  // Bug #13: soft-logout notice when another tab signed us out.
  useEffect(() => {
    if (consumeSignedOutElsewhere('STAFF')) {
      toast.info('Signed out in another tab — please sign in again.');
    }
  }, []);

  if (!ready || session) return null;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />

      {/* Header — Stamposa mark only. Alternate-role pointer is below the
          sign-in card (see AuthColumn). */}
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

      {/* Two-column body, capped at max-w-6xl and pinned to the ends of that
          container so poster + auth card don't drift apart on wide screens. */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 sm:px-10 lg:min-h-[calc(100dvh-8rem)] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:pb-24">
        <MarketingRail />
        <AuthColumn>
          <EmailAuth
            role="STAFF"
            allowSignup={false}
            onAuthenticated={() => router.replace('/staff')}
          />
        </AuthColumn>
      </main>
    </div>
  );
}

/* ---------- Right column: auth card (staff-specific) ---------- */

function AuthColumn({ children }: { children: React.ReactNode }) {
  return (
    <section className="w-full lg:w-[420px] lg:shrink-0">
      {/* Glass card. */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl sm:p-8">
        <SignInHeading />
        {/* EmailAuth for staff shows just the sign-in form — no signup tab
            (allowSignup=false), no forgot-password link (staff passwords are
            reset by the merchant, not self-service). */}
        {children}
      </div>
      {/* Merchant-login pointer sits below the card. Amber accent matches
          the rest of the auth palette. */}
      <p className="mt-4 text-center text-sm text-white/70">
        Own the business?{' '}
        <Link
          href="/merchant/login"
          className="font-medium text-amber-300 hover:text-amber-200"
        >
          Merchant sign in
        </Link>
      </p>
    </section>
  );
}

/** Only the eyebrow lives here — EmailAuth (with allowSignup=false) renders
 *  its own "Staff sign in" heading + hint below, so we don't duplicate. */
function SignInHeading() {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
      Staff portal
    </p>
  );
}

/* ---------- Left column: hero poster (staff-specific copy) ---------- */

function MarketingRail() {
  return (
    <aside className="relative hidden py-10 text-white lg:flex lg:flex-1 lg:items-center lg:justify-center lg:py-16">
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-start">
        {/* Eyebrow — live indicator + tagline in a glass pill. */}
        <div
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 backdrop-blur-md animate-rail-rise"
          style={{ animationDelay: '40ms' }}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
          </span>
          <span className="text-xs font-medium tracking-wide text-white/80">
            Built for the counter
          </span>
        </div>

        {/* Headline with amber accent + hand-drawn squiggle under the last word. */}
        <h2
          className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl animate-rail-rise"
          style={{ animationDelay: '120ms' }}
        >
          Stamp customers <br className="hidden md:block" />
          in{' '}
          <span className="relative inline-block text-amber-300">
            seconds.
            <svg
              aria-hidden
              viewBox="0 0 240 12"
              preserveAspectRatio="none"
              className="absolute inset-x-0 -bottom-1 h-2 w-full"
            >
              <path
                d="M2 8 C 60 -2, 180 -2, 238 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h2>

        <p
          className="mt-6 max-w-lg text-lg leading-relaxed text-white/70 animate-rail-rise"
          style={{ animationDelay: '200ms' }}
        >
          One tap adds a stamp. Undo within a minute if it&apos;s wrong. The customer&apos;s
          wallet pass updates instantly.
        </p>

        {/* Animated loyalty card — same demo the customer sees. */}
        <div
          className="relative mt-10 w-full animate-rail-rise"
          style={{ animationDelay: '280ms' }}
        >
          <StampCardHero />
        </div>
      </div>
    </aside>
  );
}
