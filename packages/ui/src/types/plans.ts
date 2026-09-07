/**
 * Subscription plan shapes, mirrored from the API's public plans endpoint
 * (apps/backend/src/billing/plans.ts). They live here rather than in the app's
 * API types because the marketing site's pricing page renders the same grid
 * as the merchant billing page.
 */

export type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO';

export interface PlanLimits {
  staffDevices: number;
  liveCampaigns: number | null;
  customers: number | null;
  broadcastsPerMonth: number | null;
  analyticsHistoryDays: number | null;
  cardCustomization: boolean;
  csvExport: boolean;
  badgeRemoved: boolean;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  features: string[];
  comingSoon: string[];
  recommended: boolean;
}
