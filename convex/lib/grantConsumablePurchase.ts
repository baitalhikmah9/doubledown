import type { MutationCtx } from '../_generated/server';
import type { Id , Doc } from '../_generated/dataModel';
import { ensureWalletDoc as defaultEnsureWalletDoc } from './ensureWallet';
import {
  findTokenProductByStoreProductId,
  type PaymentStore,
  type TokenProductSeed,
} from './paymentCatalog';
import {
  consumeDiscountClaimForPurchase as defaultConsumeDiscountClaimForPurchase,
  priceToMicros,
} from './promoDiscountClaim';

function buildPurchaseGrantIdempotencyKey(args: {
  store: PaymentStore;
  transactionId: string;
}): string {
  return `purchase:${args.store}:${args.transactionId}`;
}

export type GrantConsumableDeps = {
  ensureWalletDoc: typeof defaultEnsureWalletDoc;
  consumeDiscountClaimForPurchase: typeof defaultConsumeDiscountClaimForPurchase;
};

const defaultDeps: GrantConsumableDeps = {
  ensureWalletDoc: defaultEnsureWalletDoc,
  consumeDiscountClaimForPurchase: defaultConsumeDiscountClaimForPurchase,
};

export async function grantConsumablePurchase(
  ctx: MutationCtx,
  {
    products,
    purchaserAccountId,
    linkedUserId,
    store,
    productId,
    transactionId,
    revenueCatEventId,
    purchasedAt,
    rawEvent,
    priceAmountMicros,
    currencyCode,
    discountIdentifier,
    discountPercentage,
    deps,
  }: {
    products: TokenProductSeed[];
    purchaserAccountId: string;
    linkedUserId?: Id<'users'>;
    store: PaymentStore;
    productId: string;
    transactionId: string;
    revenueCatEventId: string;
    purchasedAt?: number;
    rawEvent?: Doc<'store_purchases'>['rawEvent'] | { source: string };
    priceAmountMicros?: number;
    currencyCode?: string;
    /** RevenueCat webhook event.discount_identifier (applied discount). */
    discountIdentifier?: string;
    /** RevenueCat webhook event.discount_percentage (applied percentage). */
    discountPercentage?: number;
    /** Optional test seam; production omits this and uses real modules. */
    deps?: Partial<GrantConsumableDeps>;
  }
): Promise<{ granted: boolean; balance: number; tokensGranted: number }> {
  const { ensureWalletDoc, consumeDiscountClaimForPurchase } = {
    ...defaultDeps,
    ...deps,
  };
  const product = findTokenProductByStoreProductId(products, store, productId);
  if (!product) {
    throw new Error('invalid_product');
  }

  const existingPurchase = await ctx.db
    .query('store_purchases')
    .withIndex('by_store_transaction', (q) =>
      q.eq('store', store).eq('storeTransactionId', transactionId)
    )
    .unique();

  const wallet = await ensureWalletDoc(ctx, purchaserAccountId, linkedUserId);

  if (existingPurchase) {
    return { granted: false, balance: wallet.balance, tokensGranted: 0 };
  }

  const now = purchasedAt ?? Date.now();
  const purchaseId = await ctx.db.insert('store_purchases', {
    purchaserAccountId,
    productKey: product.productKey,
    store,
    environment: store === 'test_store' ? 'SANDBOX' : undefined,
    storeTransactionId: transactionId,
    originalStoreTransactionId: transactionId,
    revenueCatEventId,
    purchasedAt: now,
    status: 'granted',
    rawEvent: rawEvent ?? { source: 'client_sync' },
    priceAmountMicros: priceAmountMicros ?? undefined,
    currencyCode,
  });

  await ctx.db.insert('wallet_transactions', {
    walletId: wallet._id,
    type: 'purchase_grant',
    amount: product.tokensGranted,
    createdAt: Date.now(),
    status: 'posted',
    source: 'purchase',
    idempotencyKey: buildPurchaseGrantIdempotencyKey({ store, transactionId }),
    productKey: product.productKey,
    store,
    storeTransactionId: transactionId,
    originalStoreTransactionId: transactionId,
    purchaseId,
    priceAmountMicros:
      priceAmountMicros ?? undefined,
    currencyCode,
  });

  const nextBalance = wallet.balance + product.tokensGranted;
  await ctx.db.patch(wallet._id, { balance: nextBalance });

  // Attribute the purchase to a pending discount claim if one exists for this
  // purchaser + product. The claim consumption re-checks the promo state,
  // product restriction, caps, claim expiry, and crucially verifies that the
  // webhook discount_identifier matches the promo's RevenueCat discount
  // identifier and that the applied percentage matches the configured one.
  // If the evidence does not match, the claim is rejected (marked expired)
  // and the purchase is NOT attributed. No-op for non-discount purchases.
  await consumeDiscountClaimForPurchase(ctx, {
    purchaserAccountId,
    productKey: product.productKey,
    purchaseId,
    priceAmountMicros,
    currencyCode,
    discountIdentifier,
    discountPercentage,
    now: Date.now(),
  });

  return {
    granted: true,
    balance: nextBalance,
    tokensGranted: product.tokensGranted,
  };
}

export { priceToMicros };
