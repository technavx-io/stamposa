/** Compact "4/10" progress indicator used in customer tables and search. */
export function ProgressPill({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] text-muted tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}
