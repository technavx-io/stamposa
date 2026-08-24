'use client';

import { Check, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The visual heart of the product: the stamp card. The final slot is the
 * reward slot; `highlightLast` pops the most recent stamp after an update.
 */
export function StampGrid({
  total,
  filled,
  size = 'md',
  highlightLast = false,
  tone = 'light',
}: {
  total: number;
  filled: number;
  size?: 'sm' | 'md' | 'lg';
  highlightLast?: boolean;
  tone?: 'light' | 'dark';
}) {
  const sizes = {
    sm: { cell: 'size-8', icon: 'size-3.5' },
    md: { cell: 'size-10', icon: 'size-4' },
    lg: { cell: 'size-12', icon: 'size-5' },
  }[size];

  const cols = total <= 8 ? 4 : 5;

  return (
    <div
      className="grid w-fit gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${filled} of ${total} stamps collected`}
    >
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled;
        const isReward = i === total - 1;
        const isLatest = highlightLast && i === filled - 1;
        return (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center rounded-full border-2 transition-colors',
              sizes.cell,
              isFilled
                ? 'border-brand-600 bg-brand-600 text-white'
                : tone === 'dark'
                  ? 'border-white/25 text-white/40'
                  : 'border-line text-zinc-300',
              !isFilled && isReward && (tone === 'dark' ? 'border-amber-300/60 text-amber-300/90' : 'border-amber-300 text-amber-400'),
              !isFilled && !isReward && 'border-dashed',
              isLatest && 'animate-pop',
            )}
          >
            {isFilled ? (
              isReward ? (
                <Gift className={sizes.icon} aria-hidden />
              ) : (
                <Check className={sizes.icon} strokeWidth={3} aria-hidden />
              )
            ) : isReward ? (
              <Gift className={sizes.icon} aria-hidden />
            ) : (
              <span className={cn('text-xs font-medium', size === 'lg' && 'text-sm')}>{i + 1}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
