'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const LENGTH = 6;

/** Six-box one-time-code input with paste support and auto-advance. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
  };

  const handleChange = (index: number, char: string) => {
    const digits = char.replace(/\D/g, '');
    if (!digits) return;
    // Support typing over an existing digit and multi-char autofill.
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(
      0,
      LENGTH,
    );
    commit(next);
    const focusIndex = Math.min(index + digits.length, LENGTH - 1);
    refs.current[focusIndex]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    commit(e.clipboardData.getData('text'));
    refs.current[Math.min(value.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            'h-12 w-full max-w-12 rounded-lg border border-line bg-surface text-center text-lg font-semibold text-strong',
            'focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20',
            'disabled:bg-canvas disabled:text-muted',
          )}
        />
      ))}
    </div>
  );
}
