'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:outline-zinc-300 dark:disabled:hover:bg-zinc-100',
  brand:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:hover:bg-brand-600',
  secondary:
    'border border-line bg-surface text-strong hover:bg-canvas focus-visible:outline-zinc-400',
  ghost: 'text-body hover:bg-surface-2 hover:text-strong focus-visible:outline-zinc-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:hover:bg-red-600',
};

const sizes: Record<Size, string> = {
  // 36px minimum keeps compact buttons comfortably tappable on phones.
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
