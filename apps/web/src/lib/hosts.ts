/**
 * Two hostnames serve this one Next.js app:
 *
 *   stamposa.com      — the informational site. Only "/", "/guide" and the
 *                       blog ("/blog" and every post under it).
 *   app.stamposa.com  — everything a visitor performs: the merchant, staff and
 *                       admin portals, plus the customer surfaces (join, card,
 *                       my-cards).
 *
 * Both are configured as separate reverse-proxy sites pointing at the same
 * process, so the split is enforced here and in middleware.ts rather than by
 * running two deployments.
 *
 * When the two env vars are unset — local development on a single origin —
 * every helper falls back to a relative path and middleware does nothing, so
 * `npm run dev` behaves exactly as it always has.
 */

export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? '';
export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? '';

/** Exact paths that belong on the informational site. */
export const SITE_PATHS = ['/', '/guide', '/blog'] as const;

/** Path prefixes whose whole subtree is informational (blog posts). */
export const SITE_PREFIXES = ['/blog/'] as const;

/** True when a path belongs on the informational site; everything else is the app. */
export function isSitePath(pathname: string): boolean {
  if ((SITE_PATHS as readonly string[]).includes(pathname)) return true;
  return SITE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Link to something a visitor performs — always on the app host. */
export function appHref(path: string): string {
  return APP_ORIGIN ? `${APP_ORIGIN}${path}` : path;
}

/** Link back to the informational site. */
export function siteHref(path: string): string {
  return SITE_ORIGIN ? `${SITE_ORIGIN}${path}` : path;
}
