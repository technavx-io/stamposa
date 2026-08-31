/** A dark, colour-free scrim that keeps white text legible over any photo. */
const SCRIM =
  'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 32%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0.62) 100%)';

type BgStyle = { color: string; cardImageUrl: string | null; imageTinted: boolean };

/**
 * CSS `background` for a card-shaped surface. With no image it's a colour
 * gradient; with an image it either tints it with the colour or (image-only)
 * lays a neutral scrim over the raw photo for legibility.
 */
export function cardBackground({ color, cardImageUrl, imageTinted }: BgStyle): string {
  if (!cardImageUrl) {
    return `linear-gradient(135deg, ${color} 0%, ${color}cc 55%, #18181b 100%)`;
  }
  if (imageTinted) {
    return `linear-gradient(135deg, ${color}e6 0%, ${color}99 45%, #18181bd9 100%), url(${cardImageUrl}) center/cover`;
  }
  return `${SCRIM}, url(${cardImageUrl}) center/cover`;
}

/**
 * CSS `background` for the full-height join page (vertical gradient). Same
 * tint/scrim logic as the card.
 */
export function joinBackground({ color, cardImageUrl, imageTinted }: BgStyle): string {
  if (!cardImageUrl) {
    return `linear-gradient(to bottom, ${color} 0%, ${color}bb 25%, #18181b 70%, #09090b 100%)`;
  }
  if (imageTinted) {
    return `linear-gradient(to bottom, ${color}e6 0%, ${color}aa 25%, #18181be6 70%, #09090b 100%), url(${cardImageUrl}) center/cover fixed`;
  }
  return `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.4) 70%, rgba(9,9,11,0.85) 100%), url(${cardImageUrl}) center/cover fixed`;
}
