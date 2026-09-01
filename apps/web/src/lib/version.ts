/**
 * What build the browser is actually running.
 *
 * Baked in at build time (NEXT_PUBLIC_* values are compile-time constants), so
 * these describe the bundle, not the server that happens to be serving it.
 * Exposed as JSON at /version — the quickest way to confirm a deploy landed
 * rather than inferring it from a page that might be cached.
 *
 * The version matches the API's; both move together via `npm run version:set`.
 */
export const BUILD_INFO = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
  commit: process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
  builtAt: process.env.NEXT_PUBLIC_BUILT_AT || 'unknown',
} as const;
