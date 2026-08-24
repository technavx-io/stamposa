'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Three-way theme control. "System" is a real choice, not a hidden default:
 * someone whose phone flips to dark at sunset should get that without
 * revisiting this.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5',
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              active
                ? 'bg-surface-2 text-strong'
                : 'text-muted hover:bg-surface-2/60 hover:text-body',
            )}
          >
            <o.icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Single-button variant for tight spots (mobile headers): flips straight
 * between light and dark rather than cycling through three states.
 */
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        'flex size-9 items-center justify-center rounded-lg text-muted transition-colors',
        'hover:bg-surface-2 hover:text-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className,
      )}
    >
      {resolved === 'dark' ? (
        <Sun className="size-4.5" aria-hidden />
      ) : (
        <Moon className="size-4.5" aria-hidden />
      )}
    </button>
  );
}
