import { describe, expect, it, jest } from '@jest/globals';
import { grantConsumablePurchase } from '@/convex/lib/grantConsumablePurchase';
import type { MutationCtx } from '@/convex/_generated/server';
import { DEFAULT_TOKEN_PRODUCTS } from '@/convex/lib/paymentCatalog';
import {
  createConvexTestCtx,
  walletDoc,
  type ConvexDoc,
} from '../helpers/convexTestCtx';

function grantCtx(args: { existingPurchase?: ConvexDoc }) {
  const wallet = walletDoc({
    id: 'wallet_1',
    purchaserAccountId: 'purchaser_1',
    balance: 5,
  });
  // In-memory fake is a structural subset of MutationCtx for these unit tests.
  const ctx = createConvexTestCtx({
    tables: {
      wallets: [wallet],
      store_purchases: args.existingPurchase ? [args.existingPurchase] : [],
      wallet_transactions: [],
    },
  });
  return ctx as MutationCtx & typeof ctx;
}

describe('grantConsumablePurchase', () => {
  it('records price/currency on the store_purchase and wallet_transaction', async () => {
    const ctx = grantCtx({});
    const consume = jest.fn(async () => undefined);
    const result = await grantConsumablePurchase(ctx, {
      products: DEFAULT_TOKEN_PRODUCTS,
      purchaserAccountId: 'purchaser_1',
      store: 'web_store',
      productId: 'consumable_4',
      transactionId: 'tx_123',
      revenueCatEventId: 'evt_1',
      priceAmountMicros: 9_000_000,
      currencyCode: 'USD',
      deps: {
        consumeDiscountClaimForPurchase: consume,
      },
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
    const ctx = grantCtx({});
    const consume = jest.fn(async () => undefined);
    await grantConsumablePurchase(ctx, {
      products: DEFAULT_TOKEN_PRODUCTS,
      purchaserAccountId: 'purchaser_1',
      store: 'web_store',
      productId: 'consumable_4',
      transactionId: 'tx_123',
      revenueCatEventId: 'evt_1',
      priceAmountMicros: 9_000_000,
      currencyCode: 'USD',
      deps: {
        consumeDiscountClaimForPurchase: consume,
      },
    });

    expect(consume).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        purchaserAccountId: 'purchaser_1',
        productKey: 'bundle_50',
        priceAmountMicros: 9_000_000,
        currencyCode: 'USD',
      })
    );
  });

  it('is idempotent: returns without inserting or consuming a claim on replay', async () => {
    const ctx = grantCtx({
      existingPurchase: {
        _id: 'purchase_existing',
        store: 'web_store',
        storeTransactionId: 'tx_123',
      },
    });
    const consume = jest.fn(async () => undefined);
    const result = await grantConsumablePurchase(ctx, {
      products: DEFAULT_TOKEN_PRODUCTS,
      purchaserAccountId: 'purchaser_1',
      store: 'web_store',
      productId: 'consumable_4',
      transactionId: 'tx_123',
      revenueCatEventId: 'evt_1',
      deps: {
        consumeDiscountClaimForPurchase: consume,
      },
    });

    expect(result.granted).toBe(false);
    expect(ctx.inserts).toEqual([]);
    expect(consume).not.toHaveBeenCalled();
  });

  it('throws on an unknown product id', async () => {
    const ctx = grantCtx({});
    await expect(
      grantConsumablePurchase(ctx, {
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
