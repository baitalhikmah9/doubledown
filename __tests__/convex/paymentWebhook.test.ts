import { describe, expect, it } from '@jest/globals';

import { canClientSyncConsumablePurchase } from '@/convex/lib/clientPurchaseSync';
import {
  buildPurchaseGrantIdempotencyKey,
  buildPurchaseReversalIdempotencyKey,
  extractPurchasePrice,
  mergePurchaserBalances,
  normalizeRevenueCatAliases,
  normalizeRevenueCatStore,
} from '@/convex/lib/paymentWebhook';

describe('paymentWebhook helpers', () => {
  it('allows client-side consumable grants only for the RevenueCat Test Store', () => {
    expect(canClientSyncConsumablePurchase('test_store')).toBe(true);
    expect(canClientSyncConsumablePurchase('app_store')).toBe(false);
    expect(canClientSyncConsumablePurchase('play_store')).toBe(false);
    expect(canClientSyncConsumablePurchase('web_store')).toBe(false);
  });

  it('normalizes RevenueCat identity aliases without duplicates', () => {
    expect(
      normalizeRevenueCatAliases({
        appUserId: 'guest-a',
        originalAppUserId: 'guest-a',
        aliases: ['guest-a', 'user-b', 'user-b'],
      })
    ).toEqual(['guest-a', 'user-b']);
  });

  it('normalizes RevenueCat store identifiers including test store', () => {
    expect(normalizeRevenueCatStore('PLAY_STORE')).toBe('play_store');
    expect(normalizeRevenueCatStore('TEST_STORE')).toBe('test_store');
    expect(normalizeRevenueCatStore('STRIPE')).toBe('web_store');
    expect(normalizeRevenueCatStore('RC_BILLING')).toBe('web_store');
    expect(normalizeRevenueCatStore('WEB_STORE')).toBe('web_store');
    expect(normalizeRevenueCatStore('unknown')).toBeNull();
  });

  it('builds deterministic idempotency keys for purchase grants and reversals', () => {
    expect(
      buildPurchaseGrantIdempotencyKey({
        store: 'app_store',
        transactionId: 'tx_123',
      })
    ).toBe('purchase:app_store:tx_123');

    expect(
      buildPurchaseReversalIdempotencyKey({
        store: 'play_store',
        transactionId: 'tx_123',
      })
    ).toBe('purchase_reversal:play_store:tx_123');
  });

  it('merges guest balances into canonical accounts without rewriting history', () => {
    expect(mergePurchaserBalances({ sourceBalance: 9, targetBalance: 12 })).toEqual({
      sourceBalanceAfter: 0,
      targetBalanceAfter: 21,
      transferAmount: 9,
    });
  });
});

describe('extractPurchasePrice', () => {
  it('prefers price_in_purchased_currency + currency (GBP)', () => {
    const result = extractPurchasePrice({
      price: 9.99,
      priceInPurchasedCurrency: 7.99,
      currency: 'GBP',
    });
    expect(result).toEqual({ priceAmountMicros: 7_990_000, currencyCode: 'GBP' });
  });

  it('falls back to USD price when purchased-currency fields are missing', () => {
    const result = extractPurchasePrice({
      price: 9.99,
      currency: 'GBP',
    });
    // Only USD price is present: persist with USD, never combine with GBP.
    expect(result).toEqual({ priceAmountMicros: 9_990_000, currencyCode: 'USD' });
  });

  it('falls back to USD price when currency is missing', () => {
    const result = extractPurchasePrice({
      price: 9.99,
      priceInPurchasedCurrency: 7.99,
    });
    expect(result).toEqual({ priceAmountMicros: 9_990_000, currencyCode: 'USD' });
  });

  it('returns empty when no price is present', () => {
    const result = extractPurchasePrice({
      currency: 'GBP',
    });
    expect(result).toEqual({});
  });

  it('returns empty when all fields are missing', () => {
    const result = extractPurchasePrice({});
    expect(result).toEqual({});
  });

  it('never combines USD price with a non-USD currency', () => {
    // price=9.99 (USD), currency=EUR, no purchased-currency field.
    // Must NOT return { priceAmountMicros: 9.99 micros, currencyCode: 'EUR' }.
    const result = extractPurchasePrice({
      price: 9.99,
      currency: 'EUR',
    });
    expect(result.currencyCode).toBe('USD');
    expect(result.priceAmountMicros).toBe(9_990_000);
  });

  it('uses purchased currency when both purchased price and currency are present, even if USD price differs', () => {
    const result = extractPurchasePrice({
      price: 12.0,
      priceInPurchasedCurrency: 10.5,
      currency: 'EUR',
    });
    expect(result).toEqual({ priceAmountMicros: 10_500_000, currencyCode: 'EUR' });
  });
});
