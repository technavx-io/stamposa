import { Info, Lightbulb } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Long-form article styling without a typography plugin: post bodies are
 * plain JSX (<p>, <h2>, <ul>, <blockquote>, <strong>, <code>) and this
 * wrapper styles the elements underneath it. Keeping the body as ordinary
 * markup means a post reads like a document in the editor, and any element
 * we haven't styled still renders sensibly.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[16.5px] leading-[1.75] text-body',
        // Paragraphs and rhythm
        '[&_p]:mt-5 [&_p:first-child]:mt-0',
        // Headings
        '[&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-[1.6rem] [&_h2]:leading-tight [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-strong',
        '[&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-[1.2rem] [&_h3]:font-semibold [&_h3]:text-strong',
        '[&_h2+p]:mt-4 [&_h3+p]:mt-3',
        // Emphasis and inline code
        '[&_strong]:font-semibold [&_strong]:text-strong',
        '[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline [&_a]:decoration-brand-300 [&_a]:underline-offset-4 hover:[&_a]:text-brand-700 dark:[&_a]:text-brand-300 dark:[&_a]:decoration-brand-500/40',
        '[&_code]:rounded-md [&_code]:border [&_code]:border-line [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-brand-mono [&_code]:text-[13.5px] [&_code]:text-strong',
        // Lists
        '[&_ul]:mt-5 [&_ul]:space-y-2.5 [&_ul]:pl-1',
        '[&_ul>li]:relative [&_ul>li]:pl-6',
        '[&_ul>li]:before:absolute [&_ul>li]:before:top-[0.72em] [&_ul>li]:before:left-1.5 [&_ul>li]:before:size-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-brand-500 [&_ul>li]:before:content-[""]',
        '[&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-6 [&_ol>li]:pl-1.5 [&_ol>li::marker]:font-brand-mono [&_ol>li::marker]:text-[13px] [&_ol>li::marker]:text-brand-600',
        // Quotes and rules
        '[&_blockquote]:mt-7 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-500 [&_blockquote]:pl-5 [&_blockquote]:font-display [&_blockquote]:text-[1.25rem] [&_blockquote]:leading-snug [&_blockquote]:text-strong',
        '[&_hr]:my-10 [&_hr]:border-line',
        // Tables (the odd comparison table)
        '[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14.5px]',
        '[&_th]:border-b [&_th]:border-line [&_th]:pb-2 [&_th]:text-left [&_th]:font-brand-mono [&_th]:text-[11px] [&_th]:tracking-widest [&_th]:text-muted [&_th]:uppercase',
        '[&_td]:border-b [&_td]:border-line-soft [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A pull-out box for an aside, a tip, or a plain-English clarification. */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'tip';
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = tone === 'tip' ? Lightbulb : Info;
  return (
    <aside
      className={cn(
        'mt-7 flex gap-3 rounded-2xl border px-5 py-4 text-[15px] leading-relaxed',
        tone === 'tip'
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100'
          : 'border-line bg-surface-2 text-body',
      )}
    >
      <Icon className="mt-1 size-4 shrink-0 opacity-70" aria-hidden />
      <div className="[&_p]:mt-2 [&_p:first-child]:mt-0">
        {title && <p className="font-semibold text-strong">{title}</p>}
        {children}
      </div>
    </aside>
  );
}

/** A screenshot with a caption, kept inside the article measure. */
export function Figure({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="mt-8">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-xl shadow-ink/5">
        {children}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-[13px] text-muted">{caption}</figcaption>
      )}
    </figure>
  );
}
