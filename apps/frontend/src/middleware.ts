import { NextResponse, type NextRequest } from 'next/server';

import { SITE_ORIGIN, isSitePath } from '@stamposa/ui/lib/hosts';

/**
 * This app serves everything a visitor performs: the merchant, staff and
 * admin portals plus the customer surfaces. The informational pages ("/",
 * /guide, /blog, /pricing) live in apps/website, so a request for one of
 * them here is redirected to the site host rather than 404ing.
 *
 * With no SITE_ORIGIN configured (a bare `next dev` with no env), "/" falls
 * through to this app's own home page, which links to the three sign-ins.
 */
export function middleware(request: NextRequest) {
  if (!SITE_ORIGIN) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (!isSitePath(pathname)) return NextResponse.next();

  return NextResponse.redirect(`${SITE_ORIGIN}${pathname}${search}`, 307);
}

export const config = {
  // Skip Next's own assets and static files — only page requests need routing.
  // /version answers here directly so a deploy can be verified per host.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|version|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)'],
};
