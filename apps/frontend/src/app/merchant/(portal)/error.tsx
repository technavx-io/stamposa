'use client';

import { useEffect } from 'react';
import { reportError } from '@stamposa/ui/components/monitoring';

/**
 * Per-portal error boundary — catches render errors under
 * /merchant/(portal)/* without falling back to the global boundary.
 * Keeps the merchant chrome intact so the user can navigate away.
 */
export default function MerchantPortalError({
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
      <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="max-w-md text-slate-600">
        We couldn&apos;t load this page. It&apos;s been reported. You can try again, or head back
        to the dashboard.
      </p>
      {error.requestId && (
        <p className="text-xs text-slate-500">Reference: {error.requestId}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Try again
        </button>
        <a
          href="/merchant/dashboard"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
