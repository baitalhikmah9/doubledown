import { describe, expect, it } from '@jest/globals';

import {
  ALL_DEFAULT_TOKEN_PRODUCTS,
  DEFAULT_TOKEN_PRODUCTS,
  findTokenProductByStoreProductId,
  getDefaultWebProductIdentifierForProductKey,
  tokenProductKeyLabel,
  WEB_TOKEN_PRODUCTS,
} from '@/convex/lib/paymentCatalog';

describe('paymentCatalog', () => {
  it('seeds the repo-backed native token bundle catalog', () => {
    expect(
      DEFAULT_TOKEN_PRODUCTS.map((product) => ({
        productKey: product.productKey,
        tokensGranted: product.tokensGranted,
      }))
    ).toEqual([
      { productKey: 'bundle_10', tokensGranted: 10 },
      { productKey: 'bundle_20', tokensGranted: 20 },
      { productKey: 'bundle_30', tokensGranted: 30 },
      { productKey: 'bundle_50', tokensGranted: 50 },
      { productKey: 'bundle_70', tokensGranted: 70 },
    ]);
  });

  it('seeds the web token bundle catalog with its own identifiers', () => {
    expect(
      WEB_TOKEN_PRODUCTS.map((product) => ({
        productKey: product.productKey,
        tokensGranted: product.tokensGranted,
        webProductId: product.webProductId,
      }))
    ).toEqual([
      { productKey: 'web_bundle_10', tokensGranted: 10, webProductId: 'consumable_v2_10' },
      { productKey: 'web_bundle_20', tokensGranted: 20, webProductId: 'consumable_v2_20' },
      { productKey: 'web_bundle_40', tokensGranted: 40, webProductId: 'consumable_v2_40' },
      { productKey: 'web_bundle_70', tokensGranted: 70, webProductId: 'consumable_v2_70' },
      { productKey: 'web_bundle_100', tokensGranted: 100, webProductId: 'consumable_v2_100' },
    ]);
  });

  it('combines both catalogs without overlapping product keys', () => {
    const keys = ALL_DEFAULT_TOKEN_PRODUCTS.map((p) => p.productKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matches native products by store-specific product id', () => {
    expect(
      findTokenProductByStoreProductId(
        DEFAULT_TOKEN_PRODUCTS,
        'app_store',
        'consumable_4'
      )?.productKey
    ).toBe('bundle_50');

    expect(
      findTokenProductByStoreProductId(
        DEFAULT_TOKEN_PRODUCTS,
        'play_store',
        'consumable_5'
      )?.productKey
    ).toBe('bundle_70');

    expect(
      findTokenProductByStoreProductId(
        DEFAULT_TOKEN_PRODUCTS,
        'test_store',
        'consumable'
      )?.productKey
    ).toBe('bundle_10');

    // Legacy web behavior: a native row matched web_store via its android id.
    expect(
      findTokenProductByStoreProductId(
        DEFAULT_TOKEN_PRODUCTS,
        'web_store',
        'consumable_4'
      )?.productKey
    ).toBe('bundle_50');
  });

  it('matches web products by their own RC Billing identifier', () => {
    const combined = [...DEFAULT_TOKEN_PRODUCTS, ...WEB_TOKEN_PRODUCTS];

    expect(
      findTokenProductByStoreProductId(combined, 'web_store', 'consumable_v2_10')?.productKey
    ).toBe('web_bundle_10');

    expect(
      findTokenProductByStoreProductId(combined, 'web_store', 'consumable_v2_100')?.productKey
    ).toBe('web_bundle_100');

    // Native lookups never match a web-only row.
    expect(
      findTokenProductByStoreProductId(combined, 'app_store', 'consumable_v2_10')
    ).toBeUndefined();

    expect(
      findTokenProductByStoreProductId(combined, 'play_store', 'consumable_v2_40')
    ).toBeUndefined();
  });

  it('keeps legacy web purchases grantable via the android id fallback', () => {
    const combined = [...DEFAULT_TOKEN_PRODUCTS, ...WEB_TOKEN_PRODUCTS];
    expect(
      findTokenProductByStoreProductId(combined, 'web_store', 'consumable_4')?.productKey
    ).toBe('bundle_50');
  });

  it('lets a canonical web row win over a colliding native android id', () => {
    // An admin-stored native row could alias a new web id as its android id.
    // When that row sorts before the web row, the web id must still resolve
    // to the web pack (webProductId pass runs before any android fallback).
    const collidingNative = {
      ...DEFAULT_TOKEN_PRODUCTS[0],
      productKey: 'bundle_10',
      androidProductId: 'consumable_v2_10',
      webProductId: undefined,
    };
    const combined = [collidingNative, ...DEFAULT_TOKEN_PRODUCTS, ...WEB_TOKEN_PRODUCTS];

    const match = findTokenProductByStoreProductId(combined, 'web_store', 'consumable_v2_10');
    expect(match?.productKey).toBe('web_bundle_10');
    expect(match?.tokensGranted).toBe(10);
    expect(match?.webProductId).toBe('consumable_v2_10');
  });

  it('ignores inactive products during store id lookup', () => {
    const disabled = DEFAULT_TOKEN_PRODUCTS.map((product) =>
      product.productKey === 'bundle_20' ? { ...product, isActive: false } : product
    );

    expect(
      findTokenProductByStoreProductId(
        disabled,
        'app_store',
        'consumable_2'
      )
    ).toBeUndefined();
  });

  it('resolves the web RC Billing identifier for web and legacy product keys', () => {
    expect(getDefaultWebProductIdentifierForProductKey('web_bundle_100')).toBe(
      'consumable_v2_100'
    );
    expect(getDefaultWebProductIdentifierForProductKey('web_bundle_40')).toBe(
      'consumable_v2_40'
    );
    // Legacy native key still resolves to its RC product for old discount promos.
    expect(getDefaultWebProductIdentifierForProductKey('bundle_70')).toBe('consumable_5');
    expect(getDefaultWebProductIdentifierForProductKey('bundle_999')).toBeNull();
  });

  it('labels product keys with their token counts', () => {
    expect(tokenProductKeyLabel('web_bundle_100')).toBe('100-token bundle');
    expect(tokenProductKeyLabel('bundle_50')).toBe('50-token bundle');
    expect(tokenProductKeyLabel('unknown_key')).toBe('unknown_key');
  });
});
