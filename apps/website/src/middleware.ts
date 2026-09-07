import { NextResponse, type NextRequest } from 'next/server';

import { APP_ORIGIN, isSitePath } from '@stamposa/ui/lib/hosts';

/**
 * This app only knows the informational pages. Anything else — an old link
 * to /merchant/login on stamposa.com, a customer's /card URL typed on the
 * wrong host — is sent to the app host instead of 404ing here.
 *
 * With no APP_ORIGIN configured (a bare `next dev` with no env), the request
 * falls through and Next renders its normal 404.
 */
export function middleware(request: NextRequest) {
  if (!APP_ORIGIN) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isSitePath(pathname)) return NextResponse.next();

  return NextResponse.redirect(`${APP_ORIGIN}${pathname}${search}`, 307);
}

export const config = {
  // Skip Next's own assets and static files — only page requests need routing.
  // /version answers here directly so a deploy can be verified per host.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|version|screens/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)'],
};
