'use client';

import { Check, Gift, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The visual heart of the product: the stamp card. The final slot is the
 * reward slot; `highlightLast` pops the most recent stamp after an update.
 *
 * Pass `onAddStamp` to make the card interactive: the next empty slot turns
 * into an "add a stamp" button (a faster shortcut alongside any Add-stamp
 * button on the page). Every other slot stays non-interactive, and all the
 * display-only usages that omit `onAddStamp` are unchanged.
 */
export function StampGrid({
  total,
  filled,
  size = 'md',
  highlightLast = false,
  tone = 'light',
  onAddStamp,
  addPending = false,
  addDisabled = false,
  stampIcon = null,
  rewardIcon = null,
}: {
  total: number;
  filled: number;
  size?: 'sm' | 'md' | 'lg';
  highlightLast?: boolean;
  tone?: 'light' | 'dark';
  /** When set, the next empty slot becomes a button that calls this. */
  onAddStamp?: () => void;
  /** Show a spinner on the next slot while a stamp is being added. */
  addPending?: boolean;
  /** Disable stamping (e.g. blocked customer, paused campaign). */
  addDisabled?: boolean;
  /** Emoji for filled stamps; null uses the default check. */
  stampIcon?: string | null;
  /** Emoji for the reward slot; null uses the default gift. */
  rewardIcon?: string | null;
}) {
  const sizes = {
    sm: { cell: 'size-8', icon: 'size-3.5', emoji: 'text-sm' },
    md: { cell: 'size-10', icon: 'size-4', emoji: 'text-lg' },
    lg: { cell: 'size-12', icon: 'size-5', emoji: 'text-2xl' },
  }[size];

  const cols = total <= 8 ? 4 : 5;

  // A filled/reward mark, honouring the custom emoji when set.
  const stampMark = stampIcon ? (
    <span className={cn('leading-none', sizes.emoji)} aria-hidden>{stampIcon}</span>
  ) : (
    <Check className={sizes.icon} strokeWidth={3} aria-hidden />
  );
  const rewardMark = rewardIcon ? (
    <span className={cn('leading-none', sizes.emoji)} aria-hidden>{rewardIcon}</span>
  ) : (
    <Gift className={sizes.icon} aria-hidden />
  );

  // Only the next unfilled slot is stampable — stamps are sequential.
  const canStamp = !!onAddStamp && !addDisabled && filled < total;

  return (
    <div
      className="grid w-fit gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role={canStamp ? 'group' : 'img'}
      aria-label={`${filled} of ${total} stamps collected`}
    >
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled;
        const isReward = i === total - 1;
        const isLatest = highlightLast && i === filled - 1;
        const isNext = i === filled;
        const stampable = canStamp && isNext;

        if (stampable) {
          return (
            <button
              key={i}
              type="button"
              onClick={onAddStamp}
              disabled={addPending}
              aria-label={isReward ? 'Add the final stamp to earn the reward' : 'Add a stamp'}
              title="Add a stamp"
              className={cn(
                'group/slot relative flex items-center justify-center rounded-full border-2 border-dashed',
                'cursor-pointer transition-all',
                sizes.cell,
                tone === 'dark'
                  ? 'border-white/40 text-white/70 hover:bg-white/10'
                  : 'border-brand-300 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/15',
                'hover:border-solid hover:border-brand-600 hover:text-brand-600',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                addPending && 'pointer-events-none',
              )}
            >
              {addPending ? (
                <Loader2 className={cn(sizes.icon, 'animate-spin')} aria-hidden />
              ) : isReward ? (
                <>
                  <span className="flex items-center justify-center transition-opacity group-hover/slot:opacity-0">
                    {rewardMark}
                  </span>
                  <Plus
                    className={cn(sizes.icon, 'absolute opacity-0 transition-opacity group-hover/slot:opacity-100')}
                    strokeWidth={3}
                    aria-hidden
                  />
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'text-xs font-medium transition-opacity group-hover/slot:opacity-0',
                      size === 'lg' && 'text-sm',
                    )}
                  >
                    {i + 1}
                  </span>
                  <Plus
                    className={cn(sizes.icon, 'absolute opacity-0 transition-opacity group-hover/slot:opacity-100')}
                    strokeWidth={3}
                    aria-hidden
                  />
                </>
              )}
            </button>
          );
        }

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
              isReward ? rewardMark : stampMark
            ) : isReward ? (
              rewardMark
            ) : (
              <span className={cn('text-xs font-medium', size === 'lg' && 'text-sm')}>{i + 1}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
