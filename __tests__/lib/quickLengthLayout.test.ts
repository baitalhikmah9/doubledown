import { BORDER_RADIUS } from '@/constants';
import { getQuickLengthOptionLayout } from '@/lib/layout/quickLengthLayout';
import { getViewportLayout, topicCardScreenPadding } from '@/lib/layout/viewportLayout';
import { getWebViewportScale } from '@/lib/layout/webViewportScale';

describe('getQuickLengthOptionLayout', () => {
  const zeroInsets = { left: 0, right: 0 };

  it('uses the same 5-column width as topic cards', () => {
    const topic = topicCardScreenPadding(1440, zeroInsets, true);
    const layout = getQuickLengthOptionLayout({
      width: 1440,
      height: 900,
      insets: zeroInsets,
      isWeb: true,
    });

    expect(layout.cardW).toBe(topic.cardW);
    expect(layout.rowWidth).toBe(topic.contentWidth);
    expect(layout.gap).toBe(topic.gap);
  });

  it('grows cards on a laptop versus phone landscape', () => {
    const phone = getQuickLengthOptionLayout({
      width: 800,
      height: 360,
      insets: zeroInsets,
      isWeb: false,
    });
    const laptop = getQuickLengthOptionLayout({
      width: 1440,
      height: 900,
      insets: zeroInsets,
      isWeb: true,
    });

    expect(laptop.cardW).toBeGreaterThan(phone.cardW);
    expect(laptop.cardH).toBeGreaterThan(phone.cardH);
    expect(laptop.titleSize).toBeGreaterThan(phone.titleSize);
  });

  it('caps height like mode tiles instead of a fixed 200px strip', () => {
    const layout = getQuickLengthOptionLayout({
      width: 1440,
      height: 900,
      insets: zeroInsets,
      isWeb: true,
    });
    const densityScale = getViewportLayout(1440, 900).scale;

    expect(layout.cardH).toBeGreaterThan(200);
    expect(layout.cardH).toBeLessThanOrEqual(Math.round(900 * 0.38 * densityScale));
    expect(layout.cardH).toBeLessThanOrEqual(layout.cardW);
  });

  it('scales web type with the shared web viewport scale', () => {
    const layout = getQuickLengthOptionLayout({
      width: 1920,
      height: 1080,
      insets: zeroInsets,
      isWeb: true,
    });
    const chromeScale = getWebViewportScale(1920, 1080);

    expect(layout.titleSize).toBe(Math.round(18 * chromeScale));
    expect(layout.radius).toBe(Math.round(22 * chromeScale));
  });

  it('uses compact native radius on short phone landscape', () => {
    const layout = getQuickLengthOptionLayout({
      width: 800,
      height: 360,
      insets: zeroInsets,
      isWeb: false,
    });
    const chromeScale = getViewportLayout(800, 360).scale;

    expect(layout.radius).toBe(Math.round(BORDER_RADIUS.sm * chromeScale));
  });
});
