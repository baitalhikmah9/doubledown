import type { PaymentStore } from './paymentCatalog';

export function normalizeRevenueCatAliases({
  appUserId,
  originalAppUserId,
  aliases,
}: {
  appUserId?: string | null;
  originalAppUserId?: string | null;
  aliases?: string[] | null;
}) {
  const ids = new Set<string>();

  for (const candidate of [appUserId, originalAppUserId, ...(aliases ?? [])]) {
    if (candidate) {
      ids.add(candidate);
    }
  }

  return Array.from(ids);
}

export function buildPurchaseGrantIdempotencyKey({
  store,
  transactionId,
}: {
  store: PaymentStore;
  transactionId: string;
}) {
  return `purchase:${store}:${transactionId}`;
}

export function buildPurchaseReversalIdempotencyKey({
  store,
  transactionId,
}: {
  store: PaymentStore;
  transactionId: string;
}) {
  return `purchase_reversal:${store}:${transactionId}`;
}

export function mergePurchaserBalances({
  sourceBalance,
  targetBalance,
}: {
  sourceBalance: number;
  targetBalance: number;
}) {
  return {
    transferAmount: sourceBalance,
    sourceBalanceAfter: 0,
    targetBalanceAfter: targetBalance + sourceBalance,
  };
}

export function normalizeRevenueCatStore(store?: string | null): PaymentStore | null {
  const normalized = store?.toLowerCase();

  if (normalized === 'app_store' || normalized === 'app store') {
    return 'app_store';
  }

  if (normalized === 'play_store' || normalized === 'play store') {
    return 'play_store';
  }

  if (normalized === 'test_store') {
    return 'test_store';
  }

  // RevenueCat Web Billing (Stripe) events use `stripe` or `rc_billing` as the store.
  if (normalized === 'stripe' || normalized === 'rc_billing' || normalized === 'web_store') {
    return 'web_store';
  }

  return null;
}

/**
 * Extract the truthful price + currency from a RevenueCat webhook purchase
 * event.
 *
 * RevenueCat exposes two price fields:
 *  - `price`: USD-normalized price (float in major currency units).
 *  - `price_in_purchased_currency`: the actual charged amount in the purchase
 *    currency (float in major currency units).
 *  - `currency`: ISO 4217 currency code for the purchase currency.
 *
 * We persist the purchased-currency amount + currency when BOTH are present
 * (the truthful post-discount charged amount). If only the USD `price` is
 * present, we persist it with currency USD. We never combine a USD `price`
 * with a non-USD purchase currency, because that would record an incorrect
 * amount for commission math.
 *
 * Returns `{ priceAmountMicros, currencyCode }` where either field may be
 * undefined when no usable price is present.
 */
export type ExtractedPurchasePrice = {
  priceAmountMicros?: number;
  currencyCode?: string;
};

export function extractPurchasePrice(args: {
  price?: unknown;
  priceInPurchasedCurrency?: unknown;
  currency?: unknown;
}): ExtractedPurchasePrice {
  const purchasedMicros = priceToMicros(args.priceInPurchasedCurrency);
  const usdMicros = priceToMicros(args.price);
  const currencyCode = asString(args.currency);
  if (purchasedMicros !== null && currencyCode) {
    return { priceAmountMicros: purchasedMicros, currencyCode };
  }
  if (usdMicros !== null) {
    return { priceAmountMicros: usdMicros, currencyCode: 'USD' };
  }
  return {};
}

function priceToMicros(price: unknown): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return null;
  }
  return Math.round(price * 1_000_000);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
