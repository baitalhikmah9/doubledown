/**
 * Match-end (winner) promo QR card sizing.
 *
 * Phone landscape leaves a flex band between the scoreboard and action buttons.
 * Cards need a large enough share of width/height so the three QR tiles + slogan
 * fill that band without large empty cream gaps (score ↔ QRs ↔ buttons).
 */

export type WinnerPromoLayoutInput = {
  windowWidth: number;
  windowHeight: number;
  platform: string;
};

export type WinnerPromoLayout = {
  compact: boolean;
  tiny: boolean;
  /** Outer promo card width (QR is slightly smaller by card padding). */
  promoWidth: number;
  /** Horizontal gap between the three platform cards. */
  promoGap: number;
};

/**
 * Size the three QR promo cards for the match-end screen.
 * Phone landscape (all platforms) uses a larger share of width/height so codes
 * fill the flex promo band between scoreboard and actions.
 */
export function getWinnerPromoLayout(input: WinnerPromoLayoutInput): WinnerPromoLayout {
  const width = Math.max(0, input.windowWidth);
  const height = Math.max(0, input.windowHeight);
  const compact = height < 800;
  const tiny = height < 500;
  // Short landscape viewports: enlarge QR cards on every platform (Android/web
  // used to under-size vs iOS and leave a large dead band).
  const phoneLandscape = compact;

  const maxCap = phoneLandscape ? (tiny ? 156 : 168) : 240;
  const widthFloor = phoneLandscape ? (tiny ? 120 : 130) : 130;
  const widthShare = width * (phoneLandscape ? (tiny ? 0.17 : 0.16) : 0.16);
  const widthCap = Math.max(widthFloor, widthShare);

  // Prior tiny share (0.24) capped cards at ~96pt on 402-tall phones.
  const heightShare = phoneLandscape
    ? tiny
      ? 0.36
      : 0.32
    : 0.34;
  const heightCap = Math.max(72, height * heightShare);

  const promoWidth = Math.min(maxCap, widthCap, heightCap);
  const promoGap = Math.min(36, Math.max(10, width * (phoneLandscape ? 0.018 : 0.025)));

  return { compact, tiny, promoWidth, promoGap };
}

/**
 * QR bitmap size inside a promo card of the given width.
 * Chrome matches promo card horizontal padding (compact 6×2 / roomy 8×2).
 * Phone landscape trims 2pt so the code fills more of the white tile face.
 */
export function getWinnerPromoQrSize(promoWidth: number, compact: boolean, _platform: string): number {
  const chrome = compact ? 12 : 16;
  // Fill more of the tile on short landscape (where dead space was worst).
  const phoneTighten = compact ? 2 : 0;
  return Math.max(56, Math.max(0, promoWidth) - chrome + phoneTighten);
}

/**
 * Font size for the orange / green / red match-end action buttons.
 * iOS phone landscape was a touch small at 14–15pt; bump by 2pt there only.
 */
export function getWinnerActionLabelSize(input: {
  platform: string;
  compact: boolean;
  tiny: boolean;
  textScale?: number;
}): number {
  const scale = input.textScale ?? 1;
  const base = input.tiny ? 14 : input.compact ? 15 : 17;
  const iosPhoneBump = input.platform === 'ios' && input.compact ? 2 : 0;
  return Math.round((base + iosPhoneBump) * scale);
}
