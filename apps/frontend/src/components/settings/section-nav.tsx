'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@stamposa/ui/lib/utils';

/**
 * Settings section nav — vertical rail on desktop, horizontal scrolling chip
 * strip on mobile. Owning page controls which section is active + what URL
 * the click routes to, so this is presentation-only.
 *
 * The active state carries real weight: a brand-tinted background, an inset
 * glow ring, a coloured indicator dot on the left, and slightly brighter
 * text — reads across the room. Inactive items lift a hair on hover so the
 * rail feels alive to the mouse.
 */

export interface SectionNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Optional right-aligned meta (e.g. a "new" pill). */
  meta?: React.ReactNode;
  /** Danger sections tint red. */
  tone?: 'default' | 'danger';
}

interface SectionNavProps {
  items: SectionNavItem[];
  active: string;
  onSelect: (key: string) => void;
}

export function SectionNav({ items, active, onSelect }: SectionNavProps) {
  return (
    <>
      {/* Mobile: horizontal chip strip. Sticky under the merchant top bar so
          switching sections stays one-tap without scrolling back up. */}
      <div className="sticky top-14 z-10 -mx-4 mb-4 border-b border-line/70 bg-canvas/85 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {items.map((item) => {
            const isActive = active === item.key;
            const isDanger = item.tone === 'danger';
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
                  isActive
                    ? isDanger
                      ? 'border-red-500 bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-10px_rgba(220,38,38,0.6)]'
                      : 'border-brand-500 bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-10px_rgba(79,70,229,0.6)]'
                    : 'border-line bg-surface text-body shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] dark:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] hover:-translate-y-px hover:border-brand-500/30 hover:bg-surface-2 hover:text-strong',
                )}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop rail */}
      <nav
        className="hidden lg:sticky lg:top-6 lg:block lg:self-start"
        aria-label="Settings sections"
      >
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = active === item.key;
            const isDanger = item.tone === 'danger';
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? isDanger
                        ? 'bg-red-500/[0.09] text-red-700 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.22)] dark:bg-red-500/[0.15] dark:text-red-200 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]'
                        : 'bg-brand-500/[0.08] text-brand-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.22),0_8px_20px_-12px_rgba(99,102,241,0.35)] dark:bg-brand-500/[0.16] dark:text-brand-100 dark:shadow-[inset_0_0_0_1px_rgba(129,140,248,0.28),0_8px_20px_-12px_rgba(99,102,241,0.55)]'
                      : 'text-body hover:translate-x-0.5 hover:bg-surface-2 hover:text-strong',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Left-edge indicator dot — reads active from across the
                      screen; only appears on the active row. */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-[3px] -translate-x-1 -translate-y-1/2 rounded-full transition-all',
                      isActive
                        ? isDanger
                          ? 'bg-red-500 opacity-100'
                          : 'bg-brand-500 opacity-100 shadow-[0_0_10px_rgba(99,102,241,0.6)]'
                        : 'bg-transparent opacity-0',
                    )}
                  />
                  <item.icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      isActive
                        ? isDanger
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-brand-600 dark:text-brand-200'
                        : 'text-muted group-hover:text-body',
                    )}
                  />
                  <span
                    className={cn(
                      'flex-1 text-left transition-[letter-spacing]',
                      isActive && 'tracking-tight',
                    )}
                  >
                    {item.label}
                  </span>
                  {item.meta}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
