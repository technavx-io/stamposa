import { NextResponse } from 'next/server';

import { BUILD_INFO } from '@/lib/version';

/**
 * Deploy verification endpoint: `curl https://stamposa.com/version`.
 *
 * Deliberately no-store. A cached answer here would defeat the only purpose
 * this route has — and a stale placeholder page has already cost us an hour
 * of confusion once.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(BUILD_INFO, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
