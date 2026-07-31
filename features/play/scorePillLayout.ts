/**
 * Viewport-proportional match score chrome (header pills / score cards).
 * Same short-side base as play typography (390) so scores track board density.
 */

const BASE_SHORT_SIDE = 390;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export type MatchScorePillMetrics = {
  /** Overall chrome scale (includes multi-team density). */
  scale: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  gap: number;
  paddingHorizontal: number;
  paddingVertical: number;
  borderRadius: number;
  adjustSize: number;
  adjustRadius: number;
  adjustFont: number;
  nameFont: number;
  scoreFont: number;
  /** null when ultra-dense (name fills flex). */
  nameMaxWidth: number | null;
  pillsGap: number;
  /** Classic side score cards (non-logo layout). */
  cardPaddingLeft: number;
  cardPaddingRight: number;
  cardPaddingVertical: number;
  cardRadius: number;
  cardGap: number;
  badgeMinWidth: number;
  badgePadH: number;
  badgePadV: number;
  badgeRadius: number;
  iconChip: number;
  iconImage: number;
};

/**
 * Score pill / card sizes scaled to the window.
 * Wide viewports (web desktop, large tablets) get a long-side boost so chrome
 * grows with the board instead of staying phone-fixed.
 */
export function getMatchScorePillMetrics(input: {
  width: number;
  height: number;
  teamCount: number;
  textScale?: number;
}): MatchScorePillMetrics {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const shortScale = shortSide / BASE_SHORT_SIDE;
  // Wide landscape / web: grow with the longer edge so desktop is not phone-sized.
  const wideBoost = longSide >= 900 ? clamp(longSide / 1050, 1, 1.45) : 1;
  const scale = clamp(shortScale * wideBoost, 0.85, 1.75);

  const teamCount = Math.max(1, Math.floor(input.teamCount));
  const ultra = teamCount >= 6;
  const dense = teamCount >= 4;
  const density = ultra ? 0.78 : dense ? 0.88 : 1;
  const m = scale * density;
  const textScale = input.textScale ?? 1;

  const px = (n: number, min = 1) => Math.max(min, Math.round(n * m));
  const font = (n: number, min = 8) => Math.max(min, Math.round(n * m * textScale));

  return {
    scale: m,
    minWidth: ultra ? 0 : px(dense ? 92 : 128),
    maxWidth: ultra ? 9999 : px(dense ? 140 : 220),
    minHeight: px(ultra ? 34 : dense ? 32 : 40),
    gap: px(dense ? 3 : 6),
    paddingHorizontal: px(ultra ? 3 : dense ? 5 : 10),
    paddingVertical: px(dense ? 3 : 5),
    borderRadius: px(dense ? 12 : 16),
    adjustSize: px(ultra ? 22 : dense ? 26 : 32),
    adjustRadius: px(ultra ? 7 : dense ? 8 : 10),
    adjustFont: font(ultra ? 14 : dense ? 16 : 18, 11),
    nameFont: font(ultra ? 10 : dense ? 11 : 13, 8),
    scoreFont: font(ultra ? 13 : dense ? 15 : 20, 11),
    nameMaxWidth: ultra ? null : px(dense ? 64 : 104),
    pillsGap: px(dense ? 5 : 8),
    cardPaddingLeft: px(12),
    cardPaddingRight: px(10),
    cardPaddingVertical: px(7),
    cardRadius: px(22),
    cardGap: px(10),
    badgeMinWidth: px(48),
    badgePadH: px(14),
    badgePadV: px(7),
    badgeRadius: px(14),
    iconChip: px(34),
    iconImage: px(24),
  };
}
