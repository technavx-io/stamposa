'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputClasses =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-strong ' +
  'placeholder:text-muted transition-colors ' +
  'focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20 ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted ' +
  'aria-invalid:border-red-400 aria-invalid:focus:outline-red-600/20';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClasses, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputClasses, 'h-auto min-h-20 py-2', className)}
      {...props}
    />
  );
});

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(inputClasses, 'pr-10', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted transition-colors hover:text-strong"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean | undefined }) => React.ReactNode;
}

/** Label + control + error wiring with stable ids. */
export function Field({ label, error, hint, optional, children }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium text-body">
        {label}
        {optional && <span className="text-xs font-normal text-muted">optional</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p className="text-[13px] text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
