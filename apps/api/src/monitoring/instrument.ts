import * as Sentry from '@sentry/node';

/**
 * Sentry bootstrap. MUST be the first import in main.ts so the SDK can
 * instrument node internals before anything else loads.
 *
 * Reads process.env directly (deliberately — this runs before Nest's
 * validated config exists). Without SENTRY_DSN every Sentry call in the
 * codebase is a silent no-op, so instrumentation costs nothing in dev.
 * Works with sentry.io or any Sentry-compatible backend (e.g. self-hosted
 * GlitchTip) — see docs/MONITORING-SETUP.md.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Errors are the product here; performance tracing is opt-in.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    // Never ship request bodies or headers — they contain phones and OTPs.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.headers;
        delete event.request.cookies;
      }
      return event;
    },
  });
}

export const sentryEnabled = Boolean(dsn);
