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
  /** When an image is set: true tints it with the colour; false = image + scrim only. */
  imageTinted: boolean;
}

type CampaignStyle = Pick<
  Campaign,
  'cardColor' | 'stampIcon' | 'rewardIcon' | 'cardImagePath' | 'cardImageTint'
>;
type BusinessStyle = Pick<
  Business,
  'brandColor' | 'stampIcon' | 'rewardIcon' | 'cardImagePath' | 'cardImageTint'
>;

/**
 * Resolve the customer card's look. Each field falls back campaign → business
 * → built-in default, so a campaign can override the business-wide look. The
 * image's tint choice travels with whichever level supplies the image.
 */
export function resolveCardStyle(
  campaign: CampaignStyle,
  business: BusinessStyle,
  apiPublicUrl: string,
): CardStyle {
  let cardImageUrl: string | null = null;
  let imageTinted = true;
  if (campaign.cardImagePath) {
    cardImageUrl = `${apiPublicUrl}${campaign.cardImagePath}`;
    imageTinted = campaign.cardImageTint;
  } else if (business.cardImagePath) {
    cardImageUrl = `${apiPublicUrl}${business.cardImagePath}`;
    imageTinted = business.cardImageTint;
  }
  return {
    color: campaign.cardColor ?? business.brandColor ?? DEFAULT_CARD_COLOR,
    stampIcon: campaign.stampIcon ?? business.stampIcon ?? null,
    rewardIcon: campaign.rewardIcon ?? business.rewardIcon ?? null,
    cardImageUrl,
    imageTinted,
  };
}
