import { describe, expect, it, jest } from '@jest/globals';
import { grantConsumablePurchase } from '@/convex/lib/grantConsumablePurchase';
import { DEFAULT_TOKEN_PRODUCTS } from '@/convex/lib/paymentCatalog';

jest.mock('@/convex/lib/ensureWallet', () => ({
  ensureWalletDoc: jest.fn(async () => ({ _id: 'wallet_1', balance: 5 })),
}));

jest.mock('@/convex/lib/promoDiscountClaim', () => ({
  ...(jest.requireActual('@/convex/lib/promoDiscountClaim') as typeof import('@/convex/lib/promoDiscountClaim')),
  consumeDiscountClaimForPurchase: jest.fn(async () => undefined),
  priceToMicros: jest.fn((price: unknown) =>
    typeof price === 'number' && Number.isFinite(price) && price >= 0
      ? Math.round(price * 1_000_000)
      : null
  ),
}));

const { consumeDiscountClaimForPurchase } = jest.requireMock(
  '@/convex/lib/promoDiscountClaim'
) as { consumeDiscountClaimForPurchase: jest.Mock };

function mockGrantCtx(args: { existingPurchase?: unknown }) {
  const inserts: { table: string; doc: Record<string, unknown> }[] = [];
  const patches: { id: unknown; patch: Record<string, unknown> }[] = [];
  const db = {
    insert: jest.fn(async (table: string, doc: Record<string, unknown>) => {
      inserts.push({ table, doc });
      return 'purchase_1';
    }),
    patch: jest.fn(async (id: unknown, patch: Record<string, unknown>) => {
      patches.push({ id, patch });
    }),
    query: jest.fn((table: string) => ({
      withIndex: () => ({
        unique: async () => (table === 'store_purchases' ? args.existingPurchase ?? null : null),
      }),
    })),
  };
  return { db, inserts, patches };
}

describe('grantConsumablePurchase', () => {
  it('records price/currency on the store_purchase and wallet_transaction', async () => {
    const ctx = mockGrantCtx({});
    const result = await grantConsumablePurchase(ctx as any, {
      products: DEFAULT_TOKEN_PRODUCTS,
      purchaserAccountId: 'purchaser_1',
      store: 'web_store',
      productId: 'consumable_4',
      transactionId: 'tx_123',
      revenueCatEventId: 'evt_1',
      priceAmountMicros: 9_000_000,
      currencyCode: 'USD',
    });

    expect(result.granted).toBe(true);
    const purchaseInsert = ctx.inserts.find((i) => i.table === 'store_purchases');
    expect(purchaseInsert?.doc.priceAmountMicros).toBe(9_000_000);
    expect(purchaseInsert?.doc.currencyCode).toBe('USD');
    const txInsert = ctx.inserts.find((i) => i.table === 'wallet_transactions');
    expect(txInsert?.doc.priceAmountMicros).toBe(9_000_000);
    expect(txInsert?.doc.currencyCode).toBe('USD');
  });

  it('calls consumeDiscountClaimForPurchase for attribution', async () => {
    const ctx = mockGrantCtx({});
    await grantConsumablePurchase(ctx as any, {
      products: DEFAULT_TOKEN_PRODUCTS,
      purchaserAccountId: 'purchaser_1',
      store: 'web_store',
      productId: 'consumable_4',
      transactionId: 'tx_123',
      revenueCatEventId: 'evt_1',
      priceAmountMicros: 9_000_000,
      currencyCode: 'USD',
    });

    expect(consumeDiscountClaimForPurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        purchaserAccountId: 'purchaser_1',
        productKey: 'bundle_50',
        purchaseId: 'purchase_1',
        priceAmountMicros: 9_000_000,
        currencyCode: 'USD',
      })
    );
  });

  it('is idempotent: returns without inserting or consuming a claim on replay', async () => {
    const ctx = mockGrantCtx({ existingPurchase: { _id: 'purchase_existing' } });
    consumeDiscountClaimForPurchase.mockClear();
    const result = await grantConsumablePurchase(ctx as any, {
      products: DEFAULT_TOKEN_PRODUCTS,
      purchaserAccountId: 'purchaser_1',
      store: 'web_store',
      productId: 'consumable_4',
      transactionId: 'tx_123',
      revenueCatEventId: 'evt_1',
    });

    expect(result.granted).toBe(false);
    expect(ctx.inserts).toEqual([]);
    expect(consumeDiscountClaimForPurchase).not.toHaveBeenCalled();
  });

  it('throws on an unknown product id', async () => {
    const ctx = mockGrantCtx({});
    await expect(
      grantConsumablePurchase(ctx as any, {
        products: DEFAULT_TOKEN_PRODUCTS,
        purchaserAccountId: 'purchaser_1',
        store: 'web_store',
        productId: 'unknown_product',
        transactionId: 'tx_123',
        revenueCatEventId: 'evt_1',
      })
    ).rejects.toThrow('invalid_product');
  });
});
