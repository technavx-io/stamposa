'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportError } from '@stamposa/ui/components/monitoring';

/**
 * Per-portal error boundary — catches render errors under
 * /admin/(console)/* without dropping the admin out to the global boundary.
 * Admins get a slightly more technical message than merchants — they can
 * cite the request id when triaging.
 */
export default function AdminConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string; requestId?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Admin console error</h1>
      <p className="max-w-md text-slate-600">
        The console hit an unexpected error. It&apos;s been reported to Sentry.
      </p>
      <details className="max-w-md rounded-md border border-slate-200 bg-slate-50 p-3 text-left text-xs text-slate-700">
        <summary className="cursor-pointer font-medium">Diagnostic details</summary>
        <div className="mt-2 space-y-1 break-words">
          <div>
            <span className="font-medium">Message:</span> {error.message || '(none)'}
          </div>
          {error.requestId && (
            <div>
              <span className="font-medium">Request id:</span> {error.requestId}
            </div>
          )}
          {error.digest && (
            <div>
              <span className="font-medium">Digest:</span> {error.digest}
            </div>
          )}
        </div>
      </details>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Retry
        </button>
        <Link
          href="/admin/merchants"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Merchants
        </Link>
      </div>
    </div>
  );
}
