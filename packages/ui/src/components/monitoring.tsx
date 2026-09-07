'use client';

import { useEffect } from 'react';

/**
 * Browser error monitoring. Active only when NEXT_PUBLIC_SENTRY_DSN is set
 * at build time; the SDK loads as a separate chunk so unconfigured builds
 * ship zero extra bytes on the critical path. Works with sentry.io or any
 * compatible backend — see docs/MONITORING-SETUP.md.
 */
export function Monitoring() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    void import('@sentry/browser').then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        sendDefaultPii: false,
        tracesSampleRate: 0,
      });
    });
  }, []);
  return null;
}

/** Report a caught error if monitoring is active; safe to call always. */
export function reportError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import('@sentry/browser').then((Sentry) => Sentry.captureException(error));
}
