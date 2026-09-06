import { describe, expect, it } from '@jest/globals';

import {
  STORE_BUNDLES,
  WEB_STORE_BUNDLES,
  BUNDLE_DISPLAY_BY_TOKENS,
  WEB_BUNDLE_DISPLAY_BY_TOKENS,
  buildDisplayBundles,
  catalogForPlatform,
  formatTokens,
} from '@/features/play/storeBundles';
import {
  DEFAULT_TOKEN_PRODUCTS,
  WEB_TOKEN_PRODUCTS,
} from '@/convex/lib/paymentCatalog';

/** Native + web catalog rows shaped like the Convex getCatalog return. */
const combinedMockCatalog = [
  ...DEFAULT_TOKEN_PRODUCTS,
  ...WEB_TOKEN_PRODUCTS,
].map((p) => ({
  productKey: p.productKey,
  tokensGranted: p.tokensGranted,
  iosProductId: p.iosProductId,
  androidProductId: p.androidProductId,
  webProductId: p.webProductId,
  isActive: p.isActive,
  sortOrder: p.sortOrder,
}));

describe('store bundles', () => {
  it('keeps the native GBP token pricing', () => {
    expect(
      STORE_BUNDLES.map((bundle) => ({
        tokens: bundle.tokens,
        priceLabel: bundle.priceLabel,
      }))
    ).toEqual([
      { tokens: 10, priceLabel: '£4.99' },
      { tokens: 20, priceLabel: '£8.99' },
      { tokens: 30, priceLabel: '£11.99' },
      { tokens: 50, priceLabel: '£16.99' },
      { tokens: 70, priceLabel: '£20.99' },
    ]);
  });

  it('uses the new GBP token pricing for the web packs', () => {
    expect(
      WEB_STORE_BUNDLES.map((bundle) => ({
        tokens: bundle.tokens,
        priceLabel: bundle.priceLabel,
      }))
    ).toEqual([
      { tokens: 10, priceLabel: '£2.99' },
      { tokens: 20, priceLabel: '£5.49' },
      { tokens: 40, priceLabel: '£9.99' },
      { tokens: 70, priceLabel: '£15.49' },
      { tokens: 100, priceLabel: '£19.99' },
    ]);
  });
});

describe('BUNDLE_DISPLAY_BY_TOKENS', () => {
  it('contains metadata for every STORE_BUNDLES entry keyed by token count', () => {
    for (const bundle of STORE_BUNDLES) {
      expect(BUNDLE_DISPLAY_BY_TOKENS[bundle.tokens]).toBeDefined();
      expect(BUNDLE_DISPLAY_BY_TOKENS[bundle.tokens]?.nameKey).toBe(bundle.nameKey);
    }
  });
});

describe('WEB_BUNDLE_DISPLAY_BY_TOKENS', () => {
  it('contains metadata for every WEB_STORE_BUNDLES entry keyed by token count', () => {
    for (const bundle of WEB_STORE_BUNDLES) {
      expect(WEB_BUNDLE_DISPLAY_BY_TOKENS[bundle.tokens]).toBeDefined();
      expect(WEB_BUNDLE_DISPLAY_BY_TOKENS[bundle.tokens]?.priceLabel).toBe(bundle.priceLabel);
    }
  });
});

describe('catalogForPlatform', () => {
  it('keeps native rows on iOS and Android and excludes web rows', () => {
    expect(catalogForPlatform(combinedMockCatalog, 'ios').map((p) => p.productKey)).toEqual([
      'bundle_10',
      'bundle_20',
      'bundle_30',
      'bundle_50',
      'bundle_70',
    ]);
    expect(catalogForPlatform(combinedMockCatalog, 'android').map((p) => p.productKey)).toEqual([
      'bundle_10',
      'bundle_20',
      'bundle_30',
      'bundle_50',
      'bundle_70',
    ]);
  });

  it('keeps web rows on web and excludes native rows', () => {
    expect(catalogForPlatform(combinedMockCatalog, 'web').map((p) => p.productKey)).toEqual([
      'web_bundle_10',
      'web_bundle_20',
      'web_bundle_40',
      'web_bundle_70',
      'web_bundle_100',
    ]);
  });
});

describe('buildDisplayBundles', () => {
  it('sorts active native products by sortOrder on iOS', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'ios');
    expect(result.map((b) => b.productKey)).toEqual([
      'bundle_10',
      'bundle_20',
      'bundle_30',
      'bundle_50',
      'bundle_70',
    ]);
  });

  it('sorts active web products by sortOrder on web', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'web');
    expect(result.map((b) => b.productKey)).toEqual([
      'web_bundle_10',
      'web_bundle_20',
      'web_bundle_40',
      'web_bundle_70',
      'web_bundle_100',
    ]);
  });

  it('filters out inactive products per platform', () => {
    const modified = combinedMockCatalog.map((p) =>
      p.productKey === 'web_bundle_20' ? { ...p, isActive: false } : p
    );
    const webResult = buildDisplayBundles(modified, {}, 'web');
    expect(webResult.map((b) => b.productKey)).not.toContain('web_bundle_20');

    const nativeResult = buildDisplayBundles(modified, {}, 'ios');
    expect(nativeResult.map((b) => b.productKey)).toContain('bundle_20');
  });

  it('maps platform product IDs correctly for iOS and Android', () => {
    const iosResult = buildDisplayBundles(combinedMockCatalog, {}, 'ios');
    expect(iosResult.map((bundle) => bundle.platformProductId)).toEqual([
      'consumable',
      'consumable_2',
      'consumable_3',
      'consumable_4',
      'consumable_5',
    ]);

    const androidResult = buildDisplayBundles(combinedMockCatalog, {}, 'android');
    expect(androidResult.map((bundle) => bundle.platformProductId)).toEqual([
      'consumable',
      'consumable_2',
      'consumable_3',
      'consumable_4',
      'consumable_5',
    ]);
  });

  it('maps platform product IDs correctly for web (web RC Billing ids)', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'web');
    expect(result.map((bundle) => bundle.platformProductId)).toEqual([
      'consumable_v2_10',
      'consumable_v2_20',
      'consumable_v2_40',
      'consumable_v2_70',
      'consumable_v2_100',
    ]);
  });

  it('uses web display metadata only for web rows', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'web');
    const bundle100 = result.find((b) => b.tokensGranted === 100);
    expect(bundle100?.productKey).toBe('web_bundle_100');
    expect(bundle100?.displayNameKey).toBe('store.packPro');
  });

  it('uses display metadata from STORE_BUNDLES when native tokens match', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'ios');
    const mega = result.find((b) => b.tokensGranted === 70);
    expect(mega?.displayNameKey).toBe('store.packMega');
    expect(mega?.icon).toBe('trophy-outline');
  });

  it('falls back to defaults when no display metadata matches', () => {
    const unknownProduct: typeof combinedMockCatalog = [
      {
        productKey: 'bundle_999',
        tokensGranted: 999,
        iosProductId: 'com.backfire.tokens.999',
        androidProductId: 'backfire_tokens_999',
        webProductId: undefined,
        isActive: true,
        sortOrder: 999,
      },
    ];
    const result = buildDisplayBundles(unknownProduct, {}, 'ios');
    expect(result[0]?.displayNameKey).toBe('store.tokenCount');
    expect(result[0]?.icon).toBe('diamond-outline');
    expect(result[0]?.isFeatured).toBe(false);
  });

  it('uses native price string when available', () => {
    const nativeProducts = {
      consumable_3: { priceString: '$4.99' },
    };
    const result = buildDisplayBundles(combinedMockCatalog, nativeProducts, 'ios');
    const bundle30 = result.find((b) => b.productKey === 'bundle_30');
    expect(bundle30?.priceLabel).toBe('$4.99');
  });

  it('falls back to the native static priceLabel when native price is missing', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'ios');
    const bundle30 = result.find((b) => b.productKey === 'bundle_30');
    expect(bundle30?.priceLabel).toBe('£11.99');
  });

  it('falls back to the web static priceLabel when web price is missing', () => {
    const result = buildDisplayBundles(combinedMockCatalog, {}, 'web');
    const bundle100 = result.find((b) => b.productKey === 'web_bundle_100');
    expect(bundle100?.priceLabel).toBe('£19.99');
    const bundle10 = result.find((b) => b.productKey === 'web_bundle_10');
    expect(bundle10?.priceLabel).toBe('£2.99');
  });

  it('uses the web price string when available', () => {
    const nativeProducts = {
      consumable_v2_100: { priceString: '£19.99' },
    };
    const result = buildDisplayBundles(combinedMockCatalog, nativeProducts, 'web');
    const bundle100 = result.find((b) => b.productKey === 'web_bundle_100');
    expect(bundle100?.priceLabel).toBe('£19.99');
  });

  it('falls back to tokens string when neither native nor static price exists', () => {
    const productNoPrice: typeof combinedMockCatalog = [
      {
        productKey: 'web_bundle_5',
        tokensGranted: 5,
        iosProductId: '',
        androidProductId: '',
        webProductId: 'consumable_v2_5',
        isActive: true,
        sortOrder: 1,
      },
    ];
    const result = buildDisplayBundles(productNoPrice, {}, 'web');
    expect(result[0]?.priceLabel).toBe('5 tokens');
  });
});

describe('formatTokens', () => {
  it('formats a number without decimals', () => {
    expect(formatTokens(1000)).toBe('1,000');
    expect(formatTokens(10)).toBe('10');
    expect(formatTokens(0)).toBe('0');
  });
});
