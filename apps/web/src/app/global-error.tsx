'use client';

import { useEffect } from 'react';
import { reportError } from '@/components/monitoring';

/**
 * Last-resort boundary for render crashes anywhere in the app. Reports the
 * error (when monitoring is configured) and offers a reload — a customer at
 * the counter should never be stuck staring at a blank page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          background: '#fafafa',
          color: '#18181b',
          margin: 0,
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
          <p style={{ fontSize: '2rem', margin: 0 }}>😵</p>
          <h1 style={{ fontSize: '1.1rem', margin: '0.75rem 0 0.25rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#71717a', margin: '0 0 1.25rem' }}>
            The error has been reported{error.digest ? ` (ref ${error.digest})` : ''}. Reloading
            usually fixes it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.6rem 1.4rem',
              borderRadius: '0.6rem',
              border: 'none',
              background: '#4f46e5',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
