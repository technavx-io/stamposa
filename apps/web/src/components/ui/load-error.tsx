'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * The one way a failed data load looks, everywhere. Shows the server's own
 * message when there is one, the request id for support, and a retry that
 * actually refetches — never a dead spinner or a silently blank panel.
 */
export function LoadError({
  error,
  onRetry,
  title = "Couldn't load this",
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const message =
    apiError?.message ?? 'Something went wrong while fetching the data. Check your connection.';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-strong">{title}</p>
      <p className="max-w-sm text-[13px] text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      )}
      {apiError?.requestId && (
        <p className="mt-2 font-mono text-[11px] text-muted">ref {apiError.requestId}</p>
      )}
    </div>
  );
}
