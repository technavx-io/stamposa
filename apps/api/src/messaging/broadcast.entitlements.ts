import { Business } from '@prisma/client';

/**
 * How many wallet broadcasts a business may send per calendar month.
 * `null` means unlimited.
 *
 * TODO(billing): the pricing tiers are Free 0 · Starter 2 · Growth 30 · Pro
 * unlimited. This is the single seam where the subscription plan plugs in.
 * Until subscriptions ship there is no plan on the business, so broadcasts are
 * ungated here (null) — the always-on daily anti-spam cap in BroadcastService
 * still protects customers from a runaway sender.
 */
export function broadcastMonthlyLimit(_business: Business): number | null {
  return null;
}
