'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Gift, Search, Stamp } from 'lucide-react';

const STEPS = [
  { label: 'Customer opens their card', detail: 'No app to install — it lives in the browser.' },
  { label: 'Staff finds them in seconds', detail: 'Scan the QR, or type a name or phone number.' },
  { label: 'One tap adds the stamp', detail: 'Recorded against the counter, with who added it.' },
  { label: 'Their card updates live', detail: 'The customer sees it while still standing there.' },
] as const;

const STEP_MS = 2600;

/**
 * A looping two-phone sequence standing in for a demo video: the same
 * moment shown from both sides of the counter, so the "updates live" claim
 * is something you watch rather than read. Pauses when scrolled out of view
 * and honours reduced-motion by holding on the finished state.
 */
export function CounterDemo() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);

  // Only animate while on screen — no work for an off-screen section.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStep(3);
      return;
    }
    if (!running) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [running]);

  const stamps = step >= 2 ? 5 : 4;

  return (
    <div ref={hostRef} className="grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-14">
      {/* The two phones */}
      <div className="flex items-end justify-center gap-3 sm:gap-8">
        <Phone caption="Customer" active={step === 0 || step === 3}>
          <div className="flex h-full flex-col bg-canvas p-3">
            <div className="rounded-xl bg-ink p-3 text-white">
              <p className="text-[10px] font-semibold">Brew &amp; Bean</p>
              <div className="my-2.5 grid grid-cols-5 gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className={`flex aspect-square items-center justify-center rounded-full border transition-all duration-500 ${
                      i < stamps
                        ? i === 4 && step >= 2
                          ? 'animate-stamp-press border-brand-500 bg-brand-500'
                          : 'border-brand-500 bg-brand-500'
                        : i === 9
                          ? 'border-dashed border-reward/50'
                          : 'border-dashed border-white/25'
                    }`}
                  >
                    {i === 9 ? (
                      <Gift className="size-2 text-reward" aria-hidden />
                    ) : i < stamps ? (
                      <Check className="size-2 text-white" aria-hidden />
                    ) : null}
                  </span>
                ))}
              </div>
              <p className="font-brand-mono text-[8px] tracking-widest text-white/50">7F3K–9QZP</p>
            </div>
            {step === 3 && (
              <div className="animate-rise mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[9px] font-medium text-emerald-800">
                New stamp added
              </div>
            )}
            {step === 0 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1.5 shadow-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded bg-ink text-[6px] text-white">
                  QR
                </span>
                <p className="text-[8px] leading-tight text-body">Show this at the counter</p>
              </div>
            )}
          </div>
        </Phone>

        <Phone caption="Counter" active={step === 1 || step === 2}>
          <div className="flex h-full flex-col bg-canvas p-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1.5 shadow-sm">
              <Search className="size-2.5 shrink-0 text-zinc-400" aria-hidden />
              <p className="font-brand-mono text-[8px] text-muted">
                {step >= 1 ? '7F3K–9QZP' : 'Phone, code or name…'}
              </p>
            </div>
            <div
              className={`mt-2 rounded-lg bg-surface p-2 shadow-sm transition-all duration-300 ${
                step >= 1 ? 'ring-1 ring-brand-200' : 'opacity-40'
              }`}
            >
              <p className="text-[9px] font-semibold text-strong">Priya Nair</p>
              <p className="text-[7px] text-muted">+91 98765 01102</p>
              <div
                className={`mt-1.5 flex items-center justify-center gap-1 rounded-md py-1.5 text-[8px] font-semibold text-white transition-colors ${
                  step === 2 ? 'bg-brand-700' : 'bg-brand-600'
                }`}
              >
                <Stamp className="size-2.5" aria-hidden />
                {step === 2 ? 'Stamp added' : 'Add stamp'}
              </div>
            </div>
          </div>
        </Phone>
      </div>

      {/* Step narration — the sequence is real, so it is numbered */}
      <ol className="mx-auto w-full max-w-sm space-y-1 lg:mx-0">
        {STEPS.map((s, i) => {
          const on = i === step;
          return (
            <li
              key={s.label}
              aria-current={on ? 'step' : undefined}
              className={`relative rounded-xl px-4 py-3 transition-colors duration-300 ${
                on ? 'bg-surface shadow-sm ring-1 ring-line/70' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-px grid size-5 shrink-0 place-items-center rounded-full font-brand-mono text-[10px] font-semibold transition-colors ${
                    on ? 'bg-brand-600 text-white' : 'bg-zinc-200 text-body'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[14px] font-medium transition-colors ${
                      on ? 'text-strong' : 'text-muted'
                    }`}
                  >
                    {s.label}
                  </p>
                  {on && <p className="mt-0.5 text-[13px] text-muted">{s.detail}</p>}
                </div>
              </div>
              {on && (
                <span
                  key={step}
                  className="absolute bottom-0 left-4 h-px bg-brand-500"
                  style={{ animation: `demo-progress ${STEP_MS}ms linear forwards` }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      <style>{`
        @keyframes demo-progress { from { width: 0 } to { width: calc(100% - 2rem) } }
        @media (prefers-reduced-motion: reduce) {
          [style*="demo-progress"] { animation: none !important; width: calc(100% - 2rem) }
        }
      `}</style>
    </div>
  );
}

function Phone({
  children,
  caption,
  active,
  className = '',
}: {
  children: React.ReactNode;
  caption: string;
  active: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className={`relative h-56 w-[7.5rem] overflow-hidden rounded-[1.4rem] border-4 bg-surface transition-all duration-500 sm:h-72 sm:w-40 sm:rounded-[1.6rem] sm:border-[5px] ${
          active
            ? 'border-ink shadow-xl shadow-ink/20'
            : 'border-line opacity-70 shadow-sm'
        }`}
      >
        <span className="absolute top-1.5 left-1/2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-900/20" />
        {children}
      </div>
      <p
        className={`mt-2.5 text-center font-brand-mono text-[10px] tracking-widest uppercase transition-colors ${
          active ? 'text-body' : 'text-zinc-400'
        }`}
      >
        {caption}
      </p>
    </div>
  );
}
