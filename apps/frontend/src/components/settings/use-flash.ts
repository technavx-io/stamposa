'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Panel save-flash — briefly renders an emerald outline around the panel so
 * the merchant sees "yes, that saved" without the page scrolling. The toast
 * confirms in prose; this is the visual receipt right where they were
 * looking. Clears itself after `duration` (default 1500ms).
 *
 * Usage:
 *   const { flashing, flash, ringClass } = useSaveFlash();
 *   // call flash() from your save handler's onSuccess
 *   <div className={cn('rounded-2xl transition-shadow', ringClass)}>…</div>
 */
export function useSaveFlash(duration = 1500) {
  const [flashing, setFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlashing(true);
    timerRef.current = setTimeout(() => setFlashing(false), duration);
  }, [duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    flashing,
    flash,
    /** Drop onto a wrapper that already has `transition-shadow`. */
    ringClass: flashing
      ? 'ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-canvas'
      : 'ring-0 ring-offset-0',
  };
}
