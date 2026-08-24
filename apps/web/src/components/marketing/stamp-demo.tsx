'use client';

import { useEffect, useRef, useState } from 'react';
import { Gift, RotateCcw, Stamp } from 'lucide-react';

const TOTAL = 10;

/**
 * The hero's centrepiece: a real stamp card the visitor can actually fill.
 * This is the product in miniature — tapping is the same gesture staff make
 * at the counter, and the tenth stamp unlocks the reward exactly as it does
 * in the app. One stamp lands on its own after a beat so the card visibly
 * invites the interaction.
 */
export function StampDemo() {
  const [filled, setFilled] = useState(0);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const nudged = useRef(false);

  const complete = filled >= TOTAL;

  // A single self-stamp demonstrates what the card does, then it waits.
  useEffect(() => {
    if (nudged.current) return;
    const t = setTimeout(() => {
      if (!nudged.current) {
        nudged.current = true;
        setFilled(1);
        setLastAt(Date.now());
      }
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  const stamp = () => {
    nudged.current = true;
    setTouched(true);
    if (complete) {
      setFilled(0);
      setLastAt(null);
      return;
    }
    setFilled((n) => Math.min(TOTAL, n + 1));
    setLastAt(Date.now());
  };

  return (
    <div className="w-full max-w-md">
      <button
        type="button"
        onClick={stamp}
        aria-label={
          complete ? 'Reward earned — reset the demo card' : `Add a stamp. ${filled} of ${TOTAL} collected`
        }
        className="group relative block w-full cursor-pointer rounded-[26px] bg-ink p-6 text-left shadow-2xl shadow-ink/25 transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400 active:scale-[0.995] sm:p-7"
        style={{
          backgroundImage:
            'radial-gradient(120% 90% at 15% 0%, #312e81 0%, #1e1b4b 55%, #17153d 100%)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-white">
              Brew &amp; Bean Coffee
            </p>
            <p className="mt-0.5 text-[13px] text-white/55">Coffee Lovers Card</p>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-brand-mono text-[11px] tracking-wide transition-colors ${
              complete ? 'bg-reward/20 text-reward' : 'bg-white/10 text-white/60'
            }`}
          >
            <Gift className="size-3.5" aria-hidden />
            {complete ? 'EARNED' : `${TOTAL - filled} TO GO`}
          </span>
        </div>

        <div className="my-7 grid grid-cols-5 justify-items-center gap-3">
          {Array.from({ length: TOTAL }).map((_, i) => {
            const isFilled = i < filled;
            const isLast = i === filled - 1;
            const isReward = i === TOTAL - 1;
            const isNext = i === filled && !complete;
            return (
              <span key={i} className="relative flex size-11 items-center justify-center sm:size-12">
                {isLast && lastAt && (
                  <span
                    key={lastAt}
                    className="animate-ink-halo absolute inset-0 rounded-full bg-brand-400"
                    aria-hidden
                  />
                )}
                <span
                  className={`flex size-full items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                    isFilled
                      ? isReward
                        ? 'border-reward bg-reward text-ink'
                        : 'border-brand-500 bg-brand-500 text-white'
                      : isReward
                        ? 'border-reward/45 border-dashed text-reward/70'
                        : 'border-white/20 border-dashed text-white/35'
                  } ${isLast && lastAt ? 'animate-stamp-press' : ''} ${
                    isNext ? 'ring-2 ring-white/25 ring-offset-2 ring-offset-transparent' : ''
                  }`}
                >
                  {isReward ? (
                    <Gift className="size-5" aria-hidden />
                  ) : isFilled ? (
                    <Stamp className="size-5" aria-hidden />
                  ) : (
                    <span className="font-brand-mono text-[13px]">{i + 1}</span>
                  )}
                </span>
              </span>
            );
          })}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-white/55">
              {complete ? 'Reward unlocked' : `${TOTAL - filled} stamp${TOTAL - filled === 1 ? '' : 's'} to go`}
            </p>
            <p className="mt-0.5 truncate font-medium text-white">1 free coffee of your choice</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-brand-mono text-[10px] tracking-widest text-white/35">CUSTOMER ID</p>
            <p className="font-brand-mono text-sm font-semibold tracking-widest text-white">
              7F3K–9QZP
            </p>
          </div>
        </div>

        {complete && (
          <div className="animate-rise mt-5 flex items-center gap-2 rounded-xl bg-reward/15 px-3 py-2 text-[13px] text-reward">
            <Gift className="size-4 shrink-0" aria-hidden />
            <span className="font-medium">
              Card complete — the free coffee is waiting at the counter.
            </span>
          </div>
        )}
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted">
        {complete ? (
          <>
            <RotateCcw className="size-3.5" aria-hidden /> Tap the card to start a fresh one
          </>
        ) : (
          <>
            <Stamp className="size-3.5" aria-hidden />
            {touched ? 'Keep tapping — 10 stamps earns the reward' : 'Tap the card to add a stamp'}
          </>
        )}
      </p>
    </div>
  );
}
