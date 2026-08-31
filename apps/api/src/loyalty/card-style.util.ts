import { Business, Campaign } from '@prisma/client';

/** The card colour when neither the campaign nor the business sets one. */
export const DEFAULT_CARD_COLOR = '#4F46E5';

export interface CardStyle {
  /** Resolved hex colour for the card background. */
  color: string;
  /** Single emoji for filled stamps, or null to use the default check. */
  stampIcon: string | null;
  /** Single emoji for the reward slot, or null to use the default gift. */
  rewardIcon: string | null;
  /** Absolute URL of the card background image, or null. */
  cardImageUrl: string | null;
}

/**
 * Resolve the customer card's look. Each field falls back campaign → business
 * → built-in default, so a campaign can override the business-wide look.
 */
export function resolveCardStyle(
  campaign: Pick<Campaign, 'cardColor' | 'stampIcon' | 'rewardIcon' | 'cardImagePath'>,
  business: Pick<Business, 'brandColor' | 'stampIcon' | 'rewardIcon' | 'cardImagePath'>,
  apiPublicUrl: string,
): CardStyle {
  const imagePath = campaign.cardImagePath ?? business.cardImagePath;
  return {
    color: campaign.cardColor ?? business.brandColor ?? DEFAULT_CARD_COLOR,
    stampIcon: campaign.stampIcon ?? business.stampIcon ?? null,
    rewardIcon: campaign.rewardIcon ?? business.rewardIcon ?? null,
    cardImageUrl: imagePath ? `${apiPublicUrl}${imagePath}` : null,
  };
}
