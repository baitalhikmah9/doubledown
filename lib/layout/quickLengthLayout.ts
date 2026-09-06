import { BORDER_RADIUS, SPACING } from '@/constants';
import { getViewportLayout, topicCardScreenPadding } from '@/lib/layout/viewportLayout';
import { getWebViewportScale } from '@/lib/layout/webViewportScale';

export type QuickLengthOptionLayout = {
  rowWidth: number;
  gap: number;
  cardW: number;
  cardH: number;
  radius: number;
  padH: number;
  padV: number;
  titleSize: number;
  titleLine: number;
  titleMargin: number;
  tokenSize: number;
  tokenLine: number;
  iconSize: number;
};

/**
 * Topic-count tiles follow the same 5-column topic row as Choose Topics / mode
 * tiles, then grow with viewport height instead of a fixed 160-220px strip.
 */
export function getQuickLengthOptionLayout(input: {
  width: number;
  height: number;
  insets: { left: number; right: number };
  isWeb: boolean;
}): QuickLengthOptionLayout {
  const viewport = getViewportLayout(input.width, input.height);
  const topicPad = topicCardScreenPadding(input.width, input.insets, input.isWeb);
  const chromeScale = input.isWeb
    ? getWebViewportScale(input.width, input.height)
    : viewport.scale;
  const densityScale = viewport.isWide ? viewport.scale : 1;
  const compact = viewport.isCompact;
  const cardW = topicPad.cardW;
  const cardH = Math.max(
    56,
    Math.min(cardW, Math.round(input.height * 0.38 * densityScale))
  );

  return {
    rowWidth: topicPad.contentWidth,
    gap: topicPad.gap,
    cardW,
    cardH,
    radius: Math.round(
      (input.isWeb ? 22 : compact ? BORDER_RADIUS.sm : BORDER_RADIUS.lg) * chromeScale
    ),
    padH: Math.round((input.isWeb ? 10 : compact ? 4 : SPACING.xs) * chromeScale),
    padV: Math.round((input.isWeb ? 22 : compact ? SPACING.sm : SPACING.md) * chromeScale),
    titleSize: Math.round((input.isWeb ? 18 : compact ? 12 : 15) * chromeScale),
    titleLine: Math.round((input.isWeb ? 22 : compact ? 14 : 18) * chromeScale),
    titleMargin: Math.round((compact && !input.isWeb ? 2 : SPACING.xs) * chromeScale),
    tokenSize: Math.round((input.isWeb ? 13 : compact ? 9 : 10) * chromeScale),
    tokenLine: Math.round((input.isWeb ? 16 : compact ? 11 : 13) * chromeScale),
    iconSize: Math.round((input.isWeb ? 13 : compact ? 10 : 12) * chromeScale),
  };
}
