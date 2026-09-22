'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@stamposa/ui/lib/utils';

/**
 * Settings section nav — vertical rail on desktop, horizontal scrolling chip
 * strip on mobile. Owning page controls which section is active + what URL
 * the click routes to, so this is presentation-only.
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
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                active === item.key
                  ? item.tone === 'danger'
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-surface text-body hover:bg-surface-2',
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop rail */}
      <nav
        className="hidden lg:sticky lg:top-6 lg:block lg:self-start"
        aria-label="Settings sections"
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = active === item.key;
            const isDanger = item.tone === 'danger';
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? isDanger
                        ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                        : 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                      : 'text-body hover:bg-surface-2 hover:text-strong',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive
                        ? isDanger
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-brand-600 dark:text-brand-200'
                        : 'text-muted group-hover:text-body',
                    )}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
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
