import { AlertTriangle } from 'lucide-react';

/**
 * Reusable banner shown at the top of every /legal/* page while the drafts
 * are pre-lawyer-review. Remove the banner (or gate it on an env flag) once
 * counsel has approved each document — DO NOT delete this component; other
 * jurisdictions or future ToS revisions will need it again.
 */
export function LegalReviewBanner() {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[14px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Draft — requires legal review.</p>
        <p className="mt-1 text-[13px] leading-relaxed">
          This document is a template written by the engineering team, not
          reviewed by counsel. Do not rely on it as the operative policy
          until a licensed attorney has signed off, replaced the placeholders
          (marked <code className="rounded bg-amber-100 px-1 py-0.5 font-brand-mono text-[12px] text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">[LEGAL REVIEW]</code>),
          and dated it below.
        </p>
      </div>
    </div>
  );
}
