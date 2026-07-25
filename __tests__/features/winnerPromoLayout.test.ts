import { describe, expect, it } from '@jest/globals';
import {
  getWinnerActionLabelSize,
  getWinnerPromoLayout,
  getWinnerPromoQrSize,
} from '@/features/play/winnerPromoLayout';

/** iPhone landscape-ish short viewport used on the match-end screen. */
const IPHONE_LANDSCAPE = { windowWidth: 874, windowHeight: 402 };

describe('getWinnerPromoLayout', () => {
  it('sizes phone landscape QR cards large enough to fill the promo band on all platforms', () => {
    const ios = getWinnerPromoLayout({ ...IPHONE_LANDSCAPE, platform: 'ios' });
    const android = getWinnerPromoLayout({ ...IPHONE_LANDSCAPE, platform: 'android' });
    const web = getWinnerPromoLayout({ ...IPHONE_LANDSCAPE, platform: 'web' });

    // Prior android/web formula left ~96pt cards and a large cream dead band.
    // min(156, max(120, 874*0.17), max(72, 402*0.36)) ≈ 144.72
    expect(android.promoWidth).toBeCloseTo(144.72, 1);
    expect(web.promoWidth).toBeCloseTo(144.72, 1);
    expect(ios.promoWidth).toBeCloseTo(144.72, 1);

    // All platforms share the larger phone-landscape sizing.
    expect(android.promoWidth).toBeGreaterThanOrEqual(140);
    expect(ios.promoWidth).toBeLessThanOrEqual(156);
    expect(ios.tiny).toBe(true);
    expect(ios.compact).toBe(true);
  });

  it('keeps large desktop web cards on tall viewports', () => {
    const layout = getWinnerPromoLayout({
      windowWidth: 1280,
      windowHeight: 900,
      platform: 'web',
    });
    expect(layout.compact).toBe(false);
    expect(layout.tiny).toBe(false);
    // min(240, max(130, 1280*0.16=204.8), max(72, 900*0.34=306)) = 204.8
    expect(layout.promoWidth).toBeCloseTo(204.8, 1);
  });
});

describe('getWinnerPromoQrSize', () => {
  it('tightens card chrome on compact so the bitmap fills more of the tile', () => {
    const promoWidth = 148;
    const iosQr = getWinnerPromoQrSize(promoWidth, true, 'ios');
    const androidQr = getWinnerPromoQrSize(promoWidth, true, 'android');
    // compact pad 6×2 = 12; phone tighten +2 → 148-12+2 = 138
    expect(iosQr).toBe(138);
    expect(androidQr).toBe(138);
    expect(getWinnerPromoQrSize(promoWidth, false, 'web')).toBe(132);
  });
});

describe('getWinnerActionLabelSize', () => {
  it('bumps iOS phone action labels by 2pt without changing android/web', () => {
    expect(
      getWinnerActionLabelSize({ platform: 'ios', compact: true, tiny: true })
    ).toBe(16);
    expect(
      getWinnerActionLabelSize({ platform: 'android', compact: true, tiny: true })
    ).toBe(14);
    expect(
      getWinnerActionLabelSize({ platform: 'web', compact: true, tiny: true })
    ).toBe(14);
    expect(
      getWinnerActionLabelSize({ platform: 'ios', compact: false, tiny: false })
    ).toBe(17);
  });
});
