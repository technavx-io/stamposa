'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Panel save-flash — briefly overlays an expanding brand-tinted glow ring
 * and a whisper-of-a-scale so the merchant sees "yes, that saved" without
 * the page scrolling. The toast confirms in prose; this is the visual
 * receipt right where they were looking.
 *
 * The animation itself lives in the section-shell's `<style>` block (see
 * `flashStyles` there) so a single class carries both the ring and the
 * scale, and both respect `prefers-reduced-motion`.
 *
 * Usage:
 *   const { flashing, flash, ringClass } = useSaveFlash();
 *   // call flash() from your save handler's onSuccess
 *   <div className={cn('rounded-2xl', ringClass)}>…</div>
 */
export function useSaveFlash(duration = 700) {
  const [flashing, setFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Force a same-tick off→on flip so the CSS animation replays on
    // repeat saves (adding the class to an element that already has it
    // never restarts the keyframes).
    setFlashing(false);
    requestAnimationFrame(() => {
      setFlashing(true);
      timerRef.current = setTimeout(() => setFlashing(false), duration);
    });
  }, [duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    flashing,
    flash,
    /** Adds the section-shell's `.saved-flash` animation — expanding
     *  brand-tinted glow ring + subtle 1.005 scale over ~600ms. */
    ringClass: flashing ? 'saved-flash' : '',
  };
}
