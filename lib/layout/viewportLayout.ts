import { BREAKPOINTS, LAYOUT, SPACING } from '@/constants';

/** Content column kinds for hybrid large-viewport placement. */
export type ContentWidthKind = 'form' | 'hub' | 'play' | 'playWide' | 'setup';

export type MainJustify = 'flex-start' | 'center';

export type ViewportLayout = {
  width: number;
  height: number;
  shortSide: number;
  /** Width at or above `BREAKPOINTS.wide` (categories/board web branch). */
  isWide: boolean;
  /** Short vertical space (phone landscape, small windows). */
  isCompact: boolean;
  /** Enough vertical space to vertically balance main content. */
  isTall: boolean;
  /** How the main content region should distribute leftover height. */
  mainJustify: MainJustify;
  /**
   * Hybrid density scale: modest growth on large windows, clamped so phone
   * layouts stay tight and desktops do not blow up.
   */
  scale: number;
};

const COMPACT_HEIGHT = 560;
const TALL_HEIGHT = 700;
const SCALE_WIDTH_REF = 860;
const SCALE_HEIGHT_REF = 620;

const SCALE_PHONE_MIN = 0.85;
const SCALE_PHONE_MAX = 1.08;
const SCALE_WIDE_MIN = 0.9;
const SCALE_WIDE_MAX = 1.15;

/**
 * Max width token for a content column kind.
 */
export function getContentMaxWidth(kind: ContentWidthKind): number {
  switch (kind) {
    case 'form':
      return LAYOUT.formMaxWidth;
    case 'hub':
      return LAYOUT.hubMaxWidth;
    case 'play':
      return LAYOUT.playMaxWidth;
    case 'playWide':
      return LAYOUT.playWideMaxWidth;
    case 'setup':
      return LAYOUT.setupMaxWidth;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Pure hybrid viewport layout for phone + large web.
 * Prefer this over per-screen magic max-widths and fixed top margins.
 */
export function getViewportLayout(width: number, height: number): ViewportLayout {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const shortSide = Math.min(safeW, safeH);
  const isWide = safeW >= BREAKPOINTS.wide;
  const isCompact = safeH < COMPACT_HEIGHT;
  const isTall = safeH >= TALL_HEIGHT;
  const mainJustify: MainJustify = isTall ? 'center' : 'flex-start';

  const rawScale = Math.min(safeW / SCALE_WIDTH_REF, safeH / SCALE_HEIGHT_REF);
  const scale = isWide
    ? Math.max(SCALE_WIDE_MIN, Math.min(SCALE_WIDE_MAX, rawScale))
    : Math.max(SCALE_PHONE_MIN, Math.min(SCALE_PHONE_MAX, rawScale));

  return {
    width: safeW,
    height: safeH,
    shortSide,
    isWide,
    isCompact,
    isTall,
    mainJustify,
    scale,
  };
}

/**
 * Safe-area floor used by the topic-card column. Prefer `topicCardScreenPadding`
 * for page chrome so headers line up with topic-card faces.
 */
export function horizontalScreenPadding(insets: { left: number; right: number }) {
  return {
    paddingLeft: Math.max(insets.left, LAYOUT.screenGutter),
    paddingRight: Math.max(insets.right, LAYOUT.screenGutter),
  };
}

const TOPIC_COLS = 5;
const TOPIC_CARD_MAX_WIDTH = 320;
const TOPIC_WEB_INNER_PAD = 40;
const TOPIC_WEB_GAP = 28;
const TOPIC_NATIVE_GAP = 16;
const TOPIC_NATIVE_COMPACT_GAP = 8;
const TOPIC_COMPACT_WIDTH = 430;

/**
 * Screen-to-content inset of a full Choose Topics row (5 cards, centered).
 * Use this as the outer padding on every page so chrome matches those card faces.
 */
export function topicCardScreenPadding(
  windowWidth: number,
  insets: { left: number; right: number },
  isWeb: boolean
) {
  const useWebLayout = isWeb && windowWidth >= BREAKPOINTS.wide;
  const gap = useWebLayout
    ? TOPIC_WEB_GAP
    : windowWidth < TOPIC_COMPACT_WIDTH
      ? TOPIC_NATIVE_COMPACT_GAP
      : TOPIC_NATIVE_GAP;
  const { paddingLeft: safeLeft, paddingRight: safeRight } = horizontalScreenPadding(insets);
  // Native: extra air past the safe-area gutter so header chrome and topic cards share
  // one inset (PlayScaffold pads both). Do not re-bleed this on the list (Android FlatList
  // rows do not stretch, so a negative margin left cards past the header).
  const topicInset = useWebLayout ? 0 : SPACING.xl;
  const paddingBaseLeft = safeLeft + topicInset;
  const paddingBaseRight = safeRight + topicInset;
  const available = Math.max(TOPIC_COLS, windowWidth - paddingBaseLeft - paddingBaseRight);
  const listWidth = useWebLayout ? Math.min(LAYOUT.playWideMaxWidth, available) : available;
  const innerPad = useWebLayout ? TOPIC_WEB_INNER_PAD : 0;
  const innerW = Math.max(TOPIC_COLS, listWidth - innerPad * 2);
  const cardW = Math.max(
    1,
    Math.min(
      TOPIC_CARD_MAX_WIDTH,
      Math.floor((innerW - gap * (TOPIC_COLS - 1)) / TOPIC_COLS)
    )
  );
  const contentWidth = cardW * TOPIC_COLS + gap * (TOPIC_COLS - 1);
  const listOrigin = paddingBaseLeft + (available - listWidth) / 2;
  const rowOrigin = listOrigin + innerPad + Math.max(0, innerW - contentWidth) / 2;
  const paddingLeft = Math.max(0, Math.round(rowOrigin));
  const paddingRight = Math.max(0, windowWidth - paddingLeft - contentWidth);
  return {
    paddingLeft,
    paddingRight,
    contentWidth,
    cardW,
    gap,
    useWebLayout,
  };
}

/**
 * Centered content frame style for a given column kind.
 * Pair with `width: '100%'` parents that use `flex: 1` / `minWidth: 0`.
 */
export function contentFrameMaxWidthStyle(kind: ContentWidthKind) {
  return {
    width: '100%' as const,
    maxWidth: getContentMaxWidth(kind),
    alignSelf: 'center' as const,
  };
}
