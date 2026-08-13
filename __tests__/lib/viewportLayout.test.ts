import {
  getContentMaxWidth,
  getViewportLayout,
  horizontalScreenPadding,
  topicCardScreenPadding,
  type ContentWidthKind,
} from '@/lib/layout/viewportLayout';
import { BREAKPOINTS, LAYOUT } from '@/constants';

describe('getViewportLayout', () => {
  it('keeps phone landscape compact and top-aligned', () => {
    const layout = getViewportLayout(800, 360);

    expect(layout.isWide).toBe(false);
    expect(layout.isCompact).toBe(true);
    expect(layout.mainJustify).toBe('flex-start');
    expect(layout.scale).toBeGreaterThanOrEqual(0.85);
    expect(layout.scale).toBeLessThanOrEqual(1.08);
    expect(layout.shortSide).toBe(360);
  });

  it('treats laptop web as wide with centered main and modest scale', () => {
    const layout = getViewportLayout(1440, 900);

    expect(layout.isWide).toBe(true);
    expect(layout.isCompact).toBe(false);
    expect(layout.mainJustify).toBe('center');
    expect(layout.scale).toBeGreaterThanOrEqual(0.9);
    expect(layout.scale).toBeLessThanOrEqual(1.15);
    // Hybrid: grows modestly, not unbounded with the long edge
    expect(layout.scale).toBeLessThan(1.2);
  });

  it('uses the shared wide breakpoint (categories/board)', () => {
    expect(getViewportLayout(BREAKPOINTS.wide - 1, 800).isWide).toBe(false);
    expect(getViewportLayout(BREAKPOINTS.wide, 800).isWide).toBe(true);
  });

  it('clamps scale on very large desktops', () => {
    const layout = getViewportLayout(3840, 2160);
    expect(layout.scale).toBeLessThanOrEqual(1.15);
  });

  it('clamps scale on tiny viewports', () => {
    const layout = getViewportLayout(320, 240);
    expect(layout.scale).toBeGreaterThanOrEqual(0.85);
  });
});

describe('getContentMaxWidth', () => {
  const kinds: ContentWidthKind[] = ['form', 'hub', 'play', 'playWide', 'setup'];

  it('maps each content kind to LAYOUT tokens', () => {
    expect(getContentMaxWidth('form')).toBe(LAYOUT.formMaxWidth);
    expect(getContentMaxWidth('hub')).toBe(LAYOUT.hubMaxWidth);
    expect(getContentMaxWidth('play')).toBe(LAYOUT.playMaxWidth);
    expect(getContentMaxWidth('playWide')).toBe(LAYOUT.playWideMaxWidth);
    expect(getContentMaxWidth('setup')).toBe(LAYOUT.setupMaxWidth);
  });

  it('keeps form width as the legacy contentMaxWidth alias', () => {
    expect(LAYOUT.formMaxWidth).toBe(LAYOUT.contentMaxWidth);
    expect(kinds).toContain('form');
  });
});

describe('horizontalScreenPadding', () => {
  it('uses screenGutter when safe-area insets are smaller', () => {
    expect(horizontalScreenPadding({ left: 0, right: 0 })).toEqual({
      paddingLeft: LAYOUT.screenGutter,
      paddingRight: LAYOUT.screenGutter,
    });
  });

  it('uses landscape safe-area when it exceeds the gutter', () => {
    expect(horizontalScreenPadding({ left: 59, right: 59 })).toEqual({
      paddingLeft: 59,
      paddingRight: 59,
    });
  });
});

describe('topicCardScreenPadding', () => {
  it('uses the topic row inset beyond the landscape safe area', () => {
    const layout = topicCardScreenPadding(844, { left: 59, right: 59 }, false);
    expect(layout.paddingLeft).toBeGreaterThanOrEqual(59 + 24);
    expect(layout.paddingRight).toBeGreaterThanOrEqual(59 + 24);
    expect(layout.paddingLeft + layout.contentWidth + layout.paddingRight).toBe(844);
    expect(layout.cardW).toBeLessThanOrEqual(320);
  });

  it('insets wide web to the topic-card faces, not the 16px screen gutter', () => {
    const layout = topicCardScreenPadding(1920, { left: 0, right: 0 }, true);
    expect(layout.paddingLeft).toBeGreaterThan(LAYOUT.screenGutter + 40);
    expect(layout.paddingLeft + layout.contentWidth + layout.paddingRight).toBe(1920);
    expect(layout.cardW).toBeLessThanOrEqual(320);
  });
});
