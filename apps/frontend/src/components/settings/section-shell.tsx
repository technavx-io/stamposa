'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@stamposa/ui/lib/utils';

/**
 * The wrapper every settings section sits in. Renders a big title +
 * description, an optional "Open public page →" affordance, and a save-flash
 * ring that briefly pulses a brand-tinted glow after a successful save.
 *
 * The visual richness lives here: a three-layer shadow (top inset highlight
 * + close definition + long ambient lift), a gradient hairline for the
 * header divider, and a hover treatment that hints the card is alive.
 *
 * Sections use `useSaveFlash()` to trigger the flash from their own save
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
  /** Flash class — bind via `useSaveFlash().ringClass` in the section owner. */
  flashRing?: string;
  children: React.ReactNode;
}

/**
 * Layered shadow stack for every settings card. Copy-paste when a wrapper
 * outside the shell (e.g. the logo upload area, the pending-images tray)
 * needs the same tactile lift.
 *
 *   inset white top-highlight    → catches light on the top edge
 *   tight 1–2px close shadow     → gives the card definition
 *   long 40–60px ambient shadow  → lifts it off the canvas
 *
 * Dark variant swaps the inset highlight to a much softer white and
 * deepens the ambient blur so cards keep their silhouette on dark canvas.
 */
export const cardShadow =
  'shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_1px_2px_rgba(15,23,42,0.06),0_16px_40px_-16px_rgba(15,23,42,0.14)] ' +
  'dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_2px_6px_rgba(0,0,0,0.35),0_24px_60px_-20px_rgba(0,0,0,0.55)]';

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
    <>
      <section
        id={id}
        className={cn(
          'group/shell relative overflow-hidden rounded-2xl border border-line/70 bg-surface',
          cardShadow,
          'transition-[box-shadow,transform] duration-500',
          // Whisper of a brand rim on hover — makes the card feel alive
          // without shouting. Kept off the mobile chip nav so we don't get
          // a permanent ring during scroll-touches.
          'hover:ring-1 hover:ring-brand-500/10 dark:hover:ring-brand-400/15',
          flashRing,
          className,
        )}
      >
        {/* Sectional header divider as soft light, not a hard 1px line —
            still legible on both themes, gone at the edges. */}
        <header className="relative flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-strong sm:text-[22px]">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          {publicHref && (
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-body',
                'shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_1px_2px_rgba(15,23,42,0.05)]',
                'dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_1px_2px_rgba(0,0,0,0.35)]',
                'transition-all hover:-translate-y-px hover:border-brand-500/30 hover:bg-surface-2 hover:text-strong',
              )}
            >
              {publicLabel} <ExternalLink className="size-3.5" />
            </a>
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] to-transparent dark:via-white/[0.07]"
          />
        </header>
        <div className={cn('px-5 py-5 sm:px-6', contentClassName)}>{children}</div>
      </section>
      <style>{sectionShellStyles}</style>
    </>
  );
}

// Save-flash keyframes and the hover-ring transition timing. Injected
// once per shell instance — cheap; browsers dedupe identical <style> nodes
// under content-based caches. Respects `prefers-reduced-motion`.
const sectionShellStyles = `
  @keyframes saved-glow {
    0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0), 0 0 0 0 rgba(99,102,241,0); }
    35%  { box-shadow: 0 0 0 6px rgba(99,102,241,0.20), 0 20px 60px -18px rgba(99,102,241,0.45); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0), 0 0 0 0 rgba(99,102,241,0); }
  }
  @keyframes saved-nudge {
    0%   { transform: translateY(0) scale(1); }
    30%  { transform: translateY(-1px) scale(1.005); }
    100% { transform: translateY(0) scale(1); }
  }
  .saved-flash {
    animation:
      saved-glow 700ms cubic-bezier(0.22, 1, 0.36, 1) both,
      saved-nudge 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .saved-flash {
      animation: none;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.35);
    }
  }
`;

// Re-export so consumers grab the flash hook from the same module they grab
// the shell — one import line per section.
export { useSaveFlash } from './use-flash';
