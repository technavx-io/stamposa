'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ChartPoint {
  day: string;
  stamps: number;
  joins: number;
}

/**
 * Deliberately hand-rolled rather than pulling in a charting library: two
 * series, one axis, no interactivity beyond a hover readout. Bars carry the
 * primary series; joins ride as a lighter overlay so both read at a glance.
 */
export function StampsChart({ data }: { data: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.stamps));
  const active = hover !== null ? data[hover] : null;

  // With 90 days of bars, labelling every one is unreadable.
  const labelEvery = data.length > 60 ? 14 : data.length > 30 ? 7 : data.length > 14 ? 3 : 1;

  return (
    <div>
      <div className="mb-3 flex h-10 items-baseline justify-between">
        <div className="flex items-center gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-brand-500" /> Stamps
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-400" /> New customers
          </span>
        </div>
        {active && (
          <div className="text-right text-[12.5px]">
            <span className="font-medium text-strong">
              {active.stamps} stamp{active.stamps === 1 ? '' : 's'}
            </span>
            {active.joins > 0 && (
              <span className="text-emerald-700"> · {active.joins} joined</span>
            )}
            <span className="ml-2 text-muted">{formatDay(active.day)}</span>
          </div>
        )}
      </div>

      <div
        className="flex h-44 items-end gap-[2px]"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Daily stamps over ${data.length} days`}
      >
        {data.map((d, i) => (
          <div
            key={d.day}
            className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
            onMouseEnter={() => setHover(i)}
          >
            {d.joins > 0 && (
              <div
                className="w-full rounded-t-[2px] bg-emerald-400"
                style={{ height: `${(d.joins / max) * 100}%`, minHeight: 2 }}
              />
            )}
            <div
              className={cn(
                'w-full rounded-t-[2px] transition-colors',
                hover === i ? 'bg-brand-600' : 'bg-brand-500/85',
                d.stamps === 0 && 'bg-surface-2',
              )}
              style={{ height: `${(d.stamps / max) * 100}%`, minHeight: d.stamps > 0 ? 3 : 2 }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-[2px]">
        {data.map((d, i) => (
          <div key={d.day} className="flex-1 text-center">
            {i % labelEvery === 0 && (
              <span className="text-[10px] whitespace-nowrap text-muted">
                {formatDayShort(d.day)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(`${day}T12:00:00`),
  );
}

function formatDayShort(day: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(`${day}T12:00:00`),
  );
}
