'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Gift, Stamp } from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { EmailAuth } from '@/components/auth/email-auth';
import { consumeSignedOutElsewhere } from '@/lib/auth/session';
import { useStoredSession } from '@/lib/auth/use-stored-session';

/**
 * Only accept an in-app `next` target (no protocol, no host, single leading
 * slash) so a crafted link cannot redirect a signed-in merchant to an outside
 * site as themselves.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function MerchantLoginPage() {
  // useSearchParams() forces a client-side render, so Next requires the tree
  // that uses it to sit under a <Suspense>. The wrapper is otherwise transparent.
  return (
    <Suspense fallback={null}>
      <MerchantLoginPageInner />
    </Suspense>
  );
}

function MerchantLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const { session, ready } = useStoredSession('MERCHANT');

  useEffect(() => {
    if (ready && session) router.replace(next ?? '/merchant/dashboard');
  }, [session, ready, router, next]);

  // Bug #13: if this tab was signed out because another tab logged out, tell
  // the user rather than dropping them on the login page with no context.
  useEffect(() => {
    if (consumeSignedOutElsewhere('MERCHANT')) {
      toast.info('Signed out in another tab — please sign in again.');
    }
  }, []);

  if (!ready || session) return null;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#1a1a26] text-white">
      {/* Local keyframes — scoped to this page only. */}
      <style>{auroraStyles}</style>

      {/* Full-page aurora + grid. The auth card floats as a glass panel on
          top; the marketing content occupies the left column with no
          background of its own, so the same aurora bleeds through both. */}
      <AuroraBackdrop />
      <GridPattern />

      {/* Header — Stamposa mark on the left only. The staff-login pointer
          moved down beneath the sign-in card (see AuthColumn below) so the
          header stays clean. */}
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

      {/* Two-column body — the aurora reaches both edges of the viewport
          via the outer container, but the CONTENT sits inside a comfortable
          max-width so the poster and auth card don't drift apart on
          ultra-wide screens. justify-between anchors the columns to the
          left/right of that max-width — no dead zone in the middle. */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 sm:px-10 lg:min-h-[calc(100dvh-8rem)] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:pb-24">
        <MarketingRail />
        <AuthColumn>
          <EmailAuth
            role="MERCHANT"
            allowSignup
            forgotPasswordHref="/merchant/forgot-password"
            onAuthenticated={(s) => {
              // Honour ?next=... when it's a safe in-app path AND the merchant
              // has a business (a brand-new signup with no business still needs
              // to finish onboarding before any billing action makes sense).
              if (s.business && next) router.replace(next);
              else router.replace(s.business ? '/merchant/dashboard' : '/merchant/onboarding');
            }}
          />
        </AuthColumn>
      </main>

    </div>
  );
}

/* ---------- Auth column (glass card + heading + trust chips) ---------- */

function AuthColumn({ children }: { children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  // EmailAuth owns its own tab state internally — we cannot read it directly
  // without editing that component. Instead we mirror it here by listening
  // for clicks on the "Sign in" / "Create account" tab buttons rendered by
  // EmailAuth, so the footer prompt below always reflects the current tab
  // regardless of whether the user switches via the tab bar or via our link.
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest('button');
      if (!btn || btn.type !== 'button') return;
      const label = btn.textContent?.trim();
      if (label === 'Sign in') setMode('login');
      else if (label === 'Create account') setMode('signup');
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, []);

  const switchTo = (target: 'login' | 'signup') => {
    const label = target === 'login' ? 'Sign in' : 'Create account';
    const btn = Array.from(cardRef.current?.querySelectorAll('button') ?? []).find(
      (b) => b.type === 'button' && b.textContent?.trim() === label,
    );
    btn?.click();
    setMode(target);
  };

  return (
    <section className="w-full lg:w-[420px] lg:shrink-0">
      {/* Glass card. Semi-transparent surface + backdrop blur so the aurora
          shows through subtly without hurting field contrast. */}
      <div
        ref={cardRef}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl sm:p-8"
      >
        <SignInHeading />
        {/* EmailAuth renders its own tabs + fields + submit — untouched. */}
        {children}
        <ModeSwitchPrompt mode={mode} onSwitch={switchTo} />
      </div>
      {/* Alternate-role pointer sits BELOW the card so it's visually related
          to the sign-in flow but doesn't clutter the card interior. */}
      <p className="mt-4 text-center text-sm text-white/70">
        Work at the counter?{' '}
        <Link href="/staff/login" className="font-medium text-amber-300 hover:text-amber-200">
          Staff login
        </Link>
      </p>
    </section>
  );
}

/** Slim page-level title stacked above the sign-in / sign-up tabs. */
function SignInHeading() {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
        Merchant portal
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
        Sign in to Stamposa
      </h1>
      <p className="mt-1.5 text-sm text-white/60">
        Run your loyalty program from any device. No app to install.
      </p>
    </div>
  );
}

/** "Don't have an account? Sign up" / "Already have an account? Log in" —
 *  mirrors whichever tab is currently active inside EmailAuth. */
function ModeSwitchPrompt({
  mode,
  onSwitch,
}: {
  mode: 'login' | 'signup';
  onSwitch: (target: 'login' | 'signup') => void;
}) {
  return (
    <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-white/70">
      {mode === 'login' ? (
        <>
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => onSwitch('signup')}
            className="font-medium text-amber-300 hover:text-amber-200"
          >
            Sign up
          </button>
        </>
      ) : (
        <>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onSwitch('login')}
            className="font-medium text-amber-300 hover:text-amber-200"
          >
            Log in
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- Left column: the hero poster ---------- */

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
            Live for merchants
          </span>
        </div>

        {/* Headline. Mixed weight: two accent words in cyan with an
            underscore-style highlight so the copy has personality. */}
        <h2
          className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl animate-rail-rise"
          style={{ animationDelay: '120ms' }}
        >
          Turn regulars <br className="hidden md:block" />
          into{' '}
          <span className="relative inline-block text-amber-300">
            revenue.
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
          Stamps, rewards, and repeat visits — one QR at the counter, no app installs,
          nothing for your customers to lose.
        </p>

        {/* Hero visual: a big loyalty card floating on the aurora. Stamps
            fill in one at a time on a loop, each with a "thud" animation
            that mimics staff pressing a real rubber stamp onto the card. */}
        <div className="relative mt-10 w-full animate-rail-rise" style={{ animationDelay: '280ms' }}>
          <StampCardHero />
        </div>
      </div>
    </aside>
  );
}

/** Animated aurora — three big soft blobs drifting on independent timings.
 *  Sized to cover the whole viewport so the poster extends everywhere. */
function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Cool: indigo anchor top-right — muted so it reads as ambient light,
          not a spotlight. */}
      <div className="absolute -top-40 -right-32 size-[720px] rounded-full bg-indigo-400/12 blur-[180px] animate-aurora-a" />
      {/* Cool: slate-lavender through the middle — nearly neutral with a
          hint of purple, softens the base without adding chroma. */}
      <div className="absolute top-1/3 left-1/3 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/10 blur-[180px] animate-aurora-b" />
      {/* Cool: soft indigo glow bottom-left — replaces the previous amber
          hint so the aurora stays fully in the cool palette. */}
      <div className="absolute -bottom-40 -left-32 size-[680px] rounded-full bg-indigo-500/10 blur-[180px] animate-aurora-c" />
      {/* Very light corner overlay only — the muted aurora doesn't need
          suppressing, but a soft vignette adds depth. */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/40" />
    </div>
  );
}

/** Faint grid pattern so the aurora reads as light through frosted glass,
 *  not just a blurry photo. */
function GridPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
      }}
    />
  );
}

/** Big loyalty card floating on the aurora, in the same visual format as
 *  the real customer card — numbered dashed circles for empty slots, a
 *  rubber-stamp icon for filled slots, a "N TO GO" pill in the top-right,
 *  and customer-id footer. Stamps fill in one at a time on a loop with a
 *  stamp-thud animation. */
function StampCardHero() {
  // Nine earnable stamps (positions 0-8) plus a reward tile at position 9.
  const TOTAL_EARNABLE = 9;
  const TICK_MS = 900;
  // filled = how many stamps are currently visible (0..TOTAL_EARNABLE+2). The
  // extra tick is a brief "reward pulse" pause before the loop resets.
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setFilled((f) => (f >= TOTAL_EARNABLE + 2 ? 0 : f + 1));
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  const rewardEarned = filled > TOTAL_EARNABLE;
  const stampsToGo = Math.max(0, TOTAL_EARNABLE - filled);
  const stamps = Array.from({ length: TOTAL_EARNABLE + 1 }, (_, i) => i);

  return (
    <div className="relative flex w-full max-w-md flex-col items-start py-6">
      {/* Soft halo directly behind the card so it feels lifted off the aurora. */}
      <div
        aria-hidden
        className="absolute inset-x-4 top-4 bottom-16 rounded-[32px] bg-gradient-to-br from-brand-500/25 via-violet-500/15 to-amber-400/15 blur-3xl"
      />

      <div className="relative w-full rounded-[24px] border border-white/10 bg-gradient-to-br from-[#232049] via-[#1c1a3a] to-[#141328] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
        {/* Header row — business name + card name on the left, "N TO GO" pill on the right. */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-white">
              Brew &amp; Bean Coffee
            </p>
            <p className="mt-0.5 text-[13px] text-white/60">Coffee Lovers Card</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
            <Gift className="size-3.5 text-amber-300" />
            {rewardEarned ? 'DONE' : `${stampsToGo} TO GO`}
          </span>
        </div>

        {/* Stamp grid — 5 across, 2 rows, all circular. */}
        <div className="mt-6 grid grid-cols-5 gap-3">
          {stamps.map((i) => {
            const isReward = i === TOTAL_EARNABLE;
            const isFilled = i < filled;
            const label = i + 1;

            if (isReward) {
              return (
                <div
                  key={i}
                  className={
                    rewardEarned
                      ? 'relative flex aspect-square items-center justify-center rounded-full border-2 border-amber-300 bg-amber-400 text-[#4a2f00] shadow-[0_0_30px_rgba(251,191,36,0.55)] animate-reward-pulse'
                      : 'flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-amber-300/70 text-amber-300'
                  }
                >
                  <Gift className="size-5" strokeWidth={2.25} />
                </div>
              );
            }

            return (
              <div
                key={i}
                className={
                  isFilled
                    ? 'relative flex aspect-square items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_18px_-4px_rgba(99,102,241,0.55)]'
                    : 'flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-white/20 text-[13px] font-medium text-white/40'
                }
              >
                {isFilled ? (
                  <span className="animate-stamp-thud">
                    <Stamp className="size-5" strokeWidth={2} />
                  </span>
                ) : (
                  label
                )}
              </div>
            );
          })}
        </div>

        {/* Footer row — reward text on the left, customer id on the right. */}
        <div className="mt-6 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
          <div className="min-w-0">
            <p className="text-[11px] text-white/50">
              {rewardEarned ? 'Reward earned' : `${stampsToGo} stamps to go`}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">1 free coffee of your choice</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Customer ID
            </p>
            <p className="mt-1 font-mono text-sm font-medium tracking-widest text-white/90">
              7F3K-9QZP
            </p>
          </div>
        </div>
      </div>

      {/* Hint line below the card. */}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-white/50">
        <Stamp className="size-3.5" strokeWidth={2} />
        Tap the card to add a stamp
      </p>
    </div>
  );
}

/* ---------- Local keyframes ---------- */

const auroraStyles = `
  @keyframes aurora-a {
    0%, 100% { transform: translate3d(0,0,0) scale(1); }
    50%      { transform: translate3d(-40px, 30px, 0) scale(1.08); }
  }
  @keyframes aurora-b {
    0%, 100% { transform: translate3d(-50%, -50%, 0) scale(1); }
    50%      { transform: translate3d(calc(-50% + 30px), calc(-50% - 25px), 0) scale(0.94); }
  }
  @keyframes aurora-c {
    0%, 100% { transform: translate3d(0,0,0) scale(1); }
    50%      { transform: translate3d(30px, -20px, 0) scale(1.06); }
  }
  .animate-aurora-a { animation: aurora-a 14s ease-in-out infinite; }
  .animate-aurora-b { animation: aurora-b 18s ease-in-out infinite; }
  .animate-aurora-c { animation: aurora-c 16s ease-in-out infinite; }

  @keyframes rail-rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-rail-rise {
    opacity: 0;
    animation: rail-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Stamp thud — mimics a rubber stamp being pressed onto the card. Starts
     large, rotated and transparent, overshoots below the target scale for a
     satisfying "thunk", then settles. */
  @keyframes stamp-thud {
    0%   { opacity: 0; transform: scale(2.4) rotate(-14deg); }
    45%  { opacity: 1; transform: scale(0.82) rotate(4deg); }
    70%  { transform: scale(1.08) rotate(-1deg); }
    100% { opacity: 1; transform: scale(1) rotate(0); }
  }
  .animate-stamp-thud {
    display: inline-flex;
    transform-origin: center;
    animation: stamp-thud 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* Reward pulse — brief celebration when the last stamp fills the card. */
  @keyframes reward-pulse {
    0%   { transform: scale(1); box-shadow: 0 0 0 rgba(251,191,36,0); }
    35%  { transform: scale(1.12); box-shadow: 0 0 40px rgba(251,191,36,0.7); }
    100% { transform: scale(1); box-shadow: 0 0 30px rgba(251,191,36,0.55); }
  }
  .animate-reward-pulse {
    animation: reward-pulse 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-aurora-a,
    .animate-aurora-b,
    .animate-aurora-c,
    .animate-rail-rise,
    .animate-stamp-thud,
    .animate-reward-pulse {
      animation: none;
    }
    .animate-rail-rise { opacity: 1; }
  }
`;
