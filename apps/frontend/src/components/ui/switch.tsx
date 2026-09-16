'use client';

import { forwardRef } from 'react';
import { cn } from '@stamposa/ui/lib/utils';

/**
 * Accessible on/off switch. A native <button role="switch"> under the hood so
 * screen readers announce state and space/enter toggle it.
 *
 * Sizing (in Tailwind units): track h-6 w-11 (24×44 px) with 2 px padding, thumb
 * size-5 (20 px). We use inline-flex + items-center on the track so the thumb
 * self-centres vertically, and translate the thumb by 20 px on the "on" state.
 * Tailwind's spacing scale skips 5.5, so we use the arbitrary value
 * translate-x-[20px] rather than translate-x-5.5 (which silently fails).
 */
export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, disabled = false, className, ...aria },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-brand-600 hover:bg-brand-700'
          : 'bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600',
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden
        // Inline style used for translateX so it works regardless of Tailwind
        // JIT arbitrary-value support (translate-x-[22px] was being dropped by
        // the compiler and the thumb never moved). 2px = padding, 22px = off
        // + track width - thumb width - padding = 44 - 20 - 2.
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
        className="pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out"
      />
    </button>
  );
});
