'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@stamposa/ui/lib/utils';
import { useSaveFlash } from './use-flash';

/**
 * The wrapper every settings section sits in. Renders a big title +
 * description, an optional "Open public page →" affordance, and a save-flash
 * ring that pulses emerald after a successful save.
 *
 * Sections use `useSectionShellFlash()` to trigger it from their own save
 * handlers — see MenuSection, PublicPageSection, etc.
 */

export interface SectionShellProps {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  /** Right-aligned link to the public preview surface this section affects. */
  publicHref?: string;
  publicLabel?: string;
  className?: string;
  contentClassName?: string;
  /** Emerald flash — bind via `useSaveFlash` in the section owner. */
  flashRing?: string;
  children: React.ReactNode;
}

export function SectionShell({
  id,
  eyebrow,
  title,
  description,
  publicHref,
  publicLabel = 'Open public page',
  className,
  contentClassName,
  flashRing,
  children,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-2xl border border-line/80 bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow duration-500',
        flashRing,
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-strong">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-[13.5px] text-muted">{description}</p>
          )}
        </div>
        {publicHref && (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-body transition-colors hover:bg-surface-2 hover:text-strong"
          >
            {publicLabel} <ExternalLink className="size-3.5" />
          </a>
        )}
      </header>
      <div className={cn('px-5 py-5 sm:px-6', contentClassName)}>{children}</div>
    </section>
  );
}

// Re-export so consumers grab the flash hook from the same module they grab
// the shell — one import line per section.
export { useSaveFlash } from './use-flash';
