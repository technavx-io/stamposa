'use client';

import { useEffect } from 'react';
import { reportError } from '@stamposa/ui/components/monitoring';

/**
 * Per-portal error boundary for the staff scanner. Staff often use this on
 * a phone at a counter with a customer waiting — keep the message short,
 * make the retry button large.
 */
export default function StaffError({
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
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Scanner error</h1>
      <p className="max-w-xs text-slate-600">
        Something broke. Please try again — the customer&apos;s stamps haven&apos;t been
        affected.
      </p>
      {error.requestId && (
        <p className="text-xs text-slate-500">Ref: {error.requestId}</p>
      )}
      <button
        onClick={reset}
        className="w-full max-w-xs rounded-lg bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-md hover:bg-indigo-500 active:bg-indigo-700"
      >
        Try again
      </button>
    </div>
  );
}
