import { NextResponse, type NextRequest } from 'next/server';

import { APP_ORIGIN, SITE_ORIGIN, isSitePath } from '@/lib/hosts';

/**
 * Keeps each hostname canonical: the informational pages answer only on the
 * site host, everything performable only on the app host. A request that
 * lands on the wrong one is redirected rather than served, so the same page
 * never exists at two URLs.
 *
 * Redirects are temporary (307) on purpose. Browsers cache permanent
 * redirects aggressively and this split is new — promote them to 308 once the
 * layout has settled and we want the SEO benefit.
 */
export function middleware(request: NextRequest) {
  // Single-origin development: no split configured, nothing to enforce.
  if (!SITE_ORIGIN || !APP_ORIGIN) return NextResponse.next();

  const host = request.headers.get('host');
  if (!host) return NextResponse.next();

  const siteHost = new URL(SITE_ORIGIN).host;
  const appHost = new URL(APP_ORIGIN).host;

  const { pathname, search } = request.nextUrl;
  const onSite = isSitePath(pathname);

  if (host === siteHost && !onSite) {
    return NextResponse.redirect(`${APP_ORIGIN}${pathname}${search}`, 307);
  }
  if (host === appHost && onSite) {
    return NextResponse.redirect(`${SITE_ORIGIN}${pathname}${search}`, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next's own assets and static files — only page requests need routing.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|screens/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)'],
};
