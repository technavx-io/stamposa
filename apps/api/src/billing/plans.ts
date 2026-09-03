import { PlanTier } from '@prisma/client';

/**
 * The plan catalog — the single source of truth for pricing, limits and
 * features. Only the PlanTier identity is stored per tenant, so changing a
 * price or a limit here never needs a migration.
 *
 * Prices are in paise (INR minor units) to keep money integer-exact. Yearly is
 * two months free. A `null` limit means unlimited. Pricing decided 2026-09-02
 * (value band): Free ₹0 · Starter ₹199 · Growth ₹499 · Pro ₹999.
 */

/** A quantity limit; null means unlimited. */
export type Limit = number | null;

export interface PlanLimits {
  /** Concurrent staff scanner devices/accounts. */
  staffDevices: number;
  /** Live (non-archived) campaigns at once. */
  liveCampaigns: Limit;
  /** Enrolled customers (members). */
  customers: Limit;
  /** Wallet push broadcasts per calendar month (0 = feature off). */
  broadcastsPerMonth: Limit;
  /** Days of analytics history; 1 = today only, null = full history. */
  analyticsHistoryDays: Limit;
  /** Card colour / image / emoji customization. */
  cardCustomization: boolean;
  /** CSV exports. */
  csvExport: boolean;
  /** Hide the "Powered by Stamposa" badge on the customer card. */
  badgeRemoved: boolean;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  tagline: string;
  /** Price in paise, keyed by billing interval. */
  price: { monthly: number; yearly: number };
  limits: PlanLimits;
  /** Human-readable feature bullets for the pricing page. */
  features: string[];
  /** Features listed but not yet shipped (shown as "coming soon"). */
  comingSoon: string[];
  /** The one plan highlighted on the pricing page. */
  recommended: boolean;
}

const RUPEE = 100; // paise per rupee

export const PLANS: Record<PlanTier, Plan> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    tagline: 'Get your loyalty card live at no cost.',
    price: { monthly: 0, yearly: 0 },
    limits: {
      staffDevices: 1,
      liveCampaigns: 1,
      customers: 100,
      broadcastsPerMonth: 0,
      analyticsHistoryDays: 1,
      cardCustomization: false,
      csvExport: false,
      badgeRemoved: false,
    },
    features: [
      'Digital stamp card',
      'Apple & Google Wallet',
      'Menu & info page',
      '1 staff device',
      'Up to 100 customers',
    ],
    comingSoon: [],
    recommended: false,
  },
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    tagline: 'For a single outlet finding its regulars.',
    price: { monthly: 199 * RUPEE, yearly: 1990 * RUPEE },
    limits: {
      staffDevices: 2,
      liveCampaigns: 1,
      customers: null,
      broadcastsPerMonth: 2,
      analyticsHistoryDays: 7,
      cardCustomization: false,
      csvExport: true,
      badgeRemoved: false,
    },
    features: [
      'Everything in Free',
      'Unlimited customers',
      '2 wallet broadcasts / month',
      '2 staff devices',
      'CSV export',
      '7-day analytics',
    ],
    comingSoon: [],
    recommended: false,
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth',
    tagline: 'For a growing brand that markets to its customers.',
    price: { monthly: 499 * RUPEE, yearly: 4990 * RUPEE },
    limits: {
      staffDevices: 5,
      liveCampaigns: 3,
      customers: null,
      broadcastsPerMonth: 30,
      analyticsHistoryDays: null,
      cardCustomization: true,
      csvExport: true,
      badgeRemoved: true,
    },
    features: [
      'Everything in Starter',
      '30 wallet broadcasts / month',
      '3 live campaigns',
      '5 staff devices',
      'Custom card look & image',
      'Full analytics history',
      'No Stamposa badge',
    ],
    comingSoon: [],
    recommended: true,
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    tagline: 'For established outlets that want it all.',
    price: { monthly: 999 * RUPEE, yearly: 9990 * RUPEE },
    limits: {
      staffDevices: 15,
      liveCampaigns: null,
      customers: null,
      broadcastsPerMonth: null,
      analyticsHistoryDays: null,
      cardCustomization: true,
      csvExport: true,
      badgeRemoved: true,
    },
    features: [
      'Everything in Growth',
      'Unlimited wallet broadcasts',
      'Unlimited campaigns',
      '15 staff devices',
    ],
    comingSoon: [],
    recommended: false,
  },
};

/** How many days the free trial lasts, and which plan it grants. */
export const TRIAL_DAYS = 30;
export const TRIAL_PLAN: PlanTier = 'GROWTH';

export const ALL_PLANS: Plan[] = [PLANS.FREE, PLANS.STARTER, PLANS.GROWTH, PLANS.PRO];

export function planFor(tier: PlanTier): Plan {
  return PLANS[tier];
}
