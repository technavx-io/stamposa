'use client';

/**
 * Shared visual pieces for the glass-auth page style used by merchant login,
 * staff login, forgot password, reset password, and onboarding.
 *
 * Ships:
 *  - `auroraStyles` — a CSS string of local keyframes; drop into a
 *    `<style>{auroraStyles}</style>` at the top of the page.
 *  - `AuroraBackdrop` — three drifting blur blobs + a soft corner vignette.
 *  - `GridPattern` — faint 52px dot grid so the aurora reads as light on
 *    frosted glass, not just a blur wash.
 *  - `StampCardHero` — the auto-animating loyalty-card demo used on the
 *    marketing rail. Fills one stamp per tick, pulses the reward tile when
 *    complete, then resets and loops.
 *
 * All pieces are self-contained: no props, no external state. Drop them in.
 */

import { useEffect, useState } from 'react';
import { Gift, Stamp } from 'lucide-react';

export function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Cool: indigo anchor top-right — muted so it reads as ambient light,
          not a spotlight. */}
      <div className="absolute -top-40 -right-32 size-[720px] rounded-full bg-indigo-400/12 blur-[180px] animate-aurora-a" />
      {/* Cool: slate-lavender through the middle — nearly neutral with a
          hint of purple, softens the base without adding chroma. */}
      <div className="absolute top-1/3 left-1/3 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/10 blur-[180px] animate-aurora-b" />
      {/* Cool: soft indigo glow bottom-left — keeps the palette fully cool. */}
      <div className="absolute -bottom-40 -left-32 size-[680px] rounded-full bg-indigo-500/10 blur-[180px] animate-aurora-c" />
      {/* Very light corner overlay only — the muted aurora doesn't need
          suppressing, but a soft vignette adds depth. */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/40" />
    </div>
  );
}

export function GridPattern() {
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

/** Auto-animating loyalty card — mirrors the customer-card format from the
 *  real product. Fills one stamp per ~900ms, pulses reward when complete,
 *  resets after a brief pause, loops forever. */
export function StampCardHero() {
  const TOTAL_EARNABLE = 9;
  const TICK_MS = 900;
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
      <div
        aria-hidden
        className="absolute inset-x-4 top-4 bottom-16 rounded-[32px] bg-gradient-to-br from-brand-500/25 via-violet-500/15 to-amber-400/15 blur-3xl"
      />

      <div className="relative w-full rounded-[24px] border border-white/10 bg-gradient-to-br from-[#232049] via-[#1c1a3a] to-[#141328] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
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

      <p className="mt-4 flex items-center gap-1.5 text-xs text-white/50">
        <Stamp className="size-3.5" strokeWidth={2} />
        Tap the card to add a stamp
      </p>
    </div>
  );
}

/** All keyframes used by the visuals — inject once per page with
 *  `<style>{auroraStyles}</style>`. Includes prefers-reduced-motion. */
export const auroraStyles = `
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
