'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Stamp } from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { ApiError } from '@/lib/api/client';
import { publicApi } from '@/lib/api/endpoints';
import { merchantSession } from '@/lib/auth/session';

/**
 * Only accept an in-app path (no protocol, no host, single leading slash).
 * Server enforces this too — we're a defence-in-depth belt-and-braces here.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/**
 * Handoff landing page. The phone opens `/merchant/handoff?token=…&goto=…`
 * from the QR the desktop just showed. This route:
 *   1. Reads the token from the URL.
 *   2. POSTs it to `/v1/merchant/handoff/consume` (public endpoint).
 *   3. Writes the returned session into `merchantSession` (same helper the
 *      email login uses), then hard-navigates to the requested landing path.
 *
 * Lives OUTSIDE the `(portal)` shell so it renders with no merchant sidebar
 * during the handshake — the person hitting this URL is not yet signed in.
 */
export default function MerchantHandoffPage() {
  // useSearchParams() forces a client render, so Next requires the tree that
  // uses it to sit under a <Suspense>. The wrapper is otherwise transparent.
  return (
    <Suspense fallback={<HandoffShell><LoadingCard /></HandoffShell>}>
      <MerchantHandoffPageInner />
    </Suspense>
  );
}

function MerchantHandoffPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const gotoRaw = searchParams.get('goto');
  const goto = safeNext(gotoRaw) ?? '/merchant/dashboard';

  const [state, setState] = useState<'loading' | 'error'>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  // Guard against React 18 strict-mode's double-mount consuming a token twice
  // (a real network POST that would fail-then-succeed and confuse the user).
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    if (!token) {
      setErrorCode('MISSING_TOKEN');
      setState('error');
      return;
    }
    (async () => {
      try {
        const session = await publicApi.consumeHandoff(token);
        merchantSession.set({ tokens: session.tokens, actor: session.actor });
        // A hard replace so the URL bar loses the one-time token before any
        // in-app code has a chance to log it — and so a phone "back" gesture
        // doesn't return to a URL whose token has already been consumed.
        router.replace(goto);
      } catch (e) {
        setErrorCode(e instanceof ApiError ? e.code : 'NETWORK_ERROR');
        setState('error');
      }
    })();
    // Empty deps: this runs exactly once. Re-consuming a single-use token
    // would fail — the ref guard + this dep list keep it deterministic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HandoffShell>
      {state === 'loading' ? <LoadingCard /> : <ExpiredCard code={errorCode} />}
    </HandoffShell>
  );
}

/* ---------- Shell (aurora + logo, matches /merchant/login) ---------- */

function HandoffShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#1a1a26] text-white">
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
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center justify-center px-6 pb-16 sm:px-10">
        <section className="w-full">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl sm:p-8">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-200">
        <Loader2 className="size-7 animate-spin" strokeWidth={2.25} />
      </span>
      <h1 className="font-display text-xl font-semibold tracking-tight text-white">
        Signing you in on this device…
      </h1>
      <p className="text-sm text-white/60">
        Handing your session over from your desktop. This only takes a second.
      </p>
    </div>
  );
}

function ExpiredCard({ code }: { code: string | null }) {
  const isExpired = code === 'HANDOFF_INVALID' || code === 'MISSING_TOKEN';
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
        <AlertTriangle className="size-7" strokeWidth={2.25} />
      </span>
      <h1 className="font-display text-xl font-semibold tracking-tight text-white">
        {isExpired ? 'This QR code has expired' : 'Something went wrong'}
      </h1>
      <p className="text-sm text-white/60">
        {isExpired
          ? 'Head back to your desktop and generate a new one — a code stays valid for five minutes.'
          : 'We couldn’t sign you in on this device. Try signing in manually below.'}
      </p>
      <Link
        href="/merchant/login"
        className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-colors hover:bg-brand-400"
      >
        Sign in manually
      </Link>
    </div>
  );
}

/* ---------- Background (identical to /merchant/login) ---------- */

function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-32 size-[720px] rounded-full bg-indigo-400/12 blur-[180px] animate-aurora-a" />
      <div className="absolute top-1/3 left-1/3 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/10 blur-[180px] animate-aurora-b" />
      <div className="absolute -bottom-40 -left-32 size-[680px] rounded-full bg-indigo-500/10 blur-[180px] animate-aurora-c" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/40" />
    </div>
  );
}

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
  @media (prefers-reduced-motion: reduce) {
    .animate-aurora-a,
    .animate-aurora-b,
    .animate-aurora-c {
      animation: none;
    }
  }
`;
