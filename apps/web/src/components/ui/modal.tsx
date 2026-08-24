'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-[2px]" aria-hidden />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel
          className={cn(
            'w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl',
            'animate-rise',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold text-strong">{title}</DialogTitle>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-body"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
