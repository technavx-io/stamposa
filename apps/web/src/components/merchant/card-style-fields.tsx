'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CARD_COLORS = [
  '#4F46E5', '#6366F1', '#0EA5E9', '#0D9488', '#059669',
  '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#7C3AED',
  '#1F2937', '#0F172A',
];

export const STAMP_EMOJIS = ['☕', '⭐', '🍕', '🍔', '🍩', '🧋', '🍦', '💇', '💅', '🏋️', '🐾', '❤️'];
export const REWARD_EMOJIS = ['🎁', '🏆', '🎉', '⭐', '☕', '🍩', '💯', '🎫', '👑', '🥳'];

/** Preset swatches + a native custom picker. Empty string = business default. */
export function CardColourChoice({
  value,
  onChange,
  fallbackLabel = 'business brand colour',
}: {
  value: string;
  onChange: (v: string) => void;
  fallbackLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {CARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Use ${c}`}
            className={cn(
              'size-7 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110',
              value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-strong',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-full border border-line" title="Custom colour">
          <span
            className="block size-full"
            style={{ background: 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)' }}
          />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#4F46E5'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-[12px] text-muted hover:text-strong"
          >
            <X className="size-3" /> Default
          </button>
        )}
      </div>
      <p className="text-[12px] text-muted">
        {value ? (
          <span className="font-mono">{value}</span>
        ) : (
          <>Using the {fallbackLabel}.</>
        )}
      </p>
    </div>
  );
}

/** Preset emoji buttons; the picked one highlights. Empty = default icon. */
export function EmojiChoice({
  value,
  onChange,
  presets,
  defaultHint,
}: {
  value: string;
  onChange: (v: string) => void;
  presets: string[];
  defaultHint: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((e) => {
          const active = value === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => onChange(active ? '' : e)}
              aria-label={`Use ${e}`}
              className={cn(
                'relative flex size-9 items-center justify-center rounded-lg border text-lg transition-colors',
                active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15'
                  : 'border-line bg-surface hover:bg-surface-2',
              )}
            >
              {e}
              {active && (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[12px] text-muted">{value ? 'Tap again to clear.' : defaultHint}</p>
    </div>
  );
}
