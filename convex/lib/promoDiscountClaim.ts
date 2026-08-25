import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { computeCommissionMicros } from './affiliateStats';
import {
  evaluateDiscountProductRestriction,
  evaluatePromoRedemption,
} from './promoRules';

/**
 * Default pending-claim lifetime. A validated discount code must be used for
 * checkout within this window; after it expires the claim can no longer
 * attribute a purchase to the promo.
 */
export const DISCOUNT_CLAIM_TTL_MS = 60 * 60 * 1000;

export const DISCOUNT_CLAIM_STATUS_PENDING = 'pending';
export const DISCOUNT_CLAIM_STATUS_CONSUMED = 'consumed';
export const DISCOUNT_CLAIM_STATUS_EXPIRED = 'expired';
export const DISCOUNT_CLAIM_STATUS_REJECTED = 'rejected';

/**
 * Convert a RevenueCat webhook price (float in major currency units) to
 * integer micros. Returns null when the value is missing or non-finite so
 * callers can skip attribution instead of inventing a total.
 */
export function priceToMicros(price: unknown): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return null;
  }
  return Math.round(price * 1_000_000);
}

/**
 * Find the most recent non-expired pending claim for a purchaser + product.
 * Expires any stale pending claims it encounters along the way.
 */
export async function findActivePendingClaimForPurchase(
  ctx: MutationCtx,
  purchaserAccountId: string,
  productKey: string,
  now: number
) {
  const rows = await ctx.db
    .query('promo_discount_claims')
    .withIndex('by_purchaser_product_status', (q) =>
      q
        .eq('purchaserAccountId', purchaserAccountId)
        .eq('productKey', productKey)
        .eq('status', DISCOUNT_CLAIM_STATUS_PENDING)
    )
    .collect();

  let latest: Doc<'promo_discount_claims'> | null = null;

  for (const row of rows) {
    if (row.expiresAt != null && row.expiresAt <= now) {
      await ctx.db.patch(row._id, {
        status: DISCOUNT_CLAIM_STATUS_EXPIRED,
      });
      continue;
    }
    if (!latest || row.claimedAt > latest.claimedAt) {
      latest = row;
    }
  }

  return latest;
}

/**
 * Compute commission micros from the actual post-discount charged amount.
 * Falls back to 0 when price or commission percent is missing/invalid so a
 * partial webhook never inflates affiliate earnings.
 */
export function computePurchaseCommissionMicros(args: {
  priceAmountMicros?: number | null;
  commissionPercent?: number;
}): number | undefined {
  if (args.priceAmountMicros === undefined || args.priceAmountMicros === null) {
    return undefined;
  }
  if (!Number.isInteger(args.priceAmountMicros) || args.priceAmountMicros < 0) {
    return undefined;
  }
  if (
    args.commissionPercent === undefined ||
    !Number.isInteger(args.commissionPercent) ||
    args.commissionPercent < 0
  ) {
    return undefined;
  }
  return computeCommissionMicros(args.priceAmountMicros, args.commissionPercent);
}

/**
 * Normalize a RevenueCat webhook `discount_percentage` value to the 1..100
 * integer percent scale used by our configured `discountPercent`.
 *
 * RevenueCat documents `discount_percentage` as a percentage (e.g. 20 for
 * 20%). Some client libraries or test fixtures may send a 0..1 fraction
 * (0.2 for 20%). To be tolerant without accepting ambiguous values:
 *  - Values in (0, 1] are treated as fractions and multiplied by 100, then
 *    rounded to the nearest integer.
 *  - Values in (1, 100] are used as-is (rounded to the nearest integer).
 *  - Values > 100 or <= 0 are returned as-is (the caller's exact-match check
 *    will then reject them, which is the correct outcome for invalid input).
 *
 * Returns undefined for non-finite/non-number input.
 */
export function normalizeDiscountPercentage(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  if (value > 0 && value <= 1) {
    return Math.round(value * 100);
  }
  return Math.round(value);
}

/**
 * Verify that the RevenueCat webhook discount evidence matches the configured
 * promo. Attribution requires:
 *  - `discountIdentifier` matches `promo.revenueCatDiscountIdentifier` exactly.
 *  - When `promo.discountPercent` and the normalized `appliedPercentage` are
 *    both present, they must match. The applied percentage is normalized via
 *    `normalizeDiscountPercentage` so both 20 and 0.2 match a configured 20%.
 *
 * If the promo was never provisioned (no revenueCatDiscountIdentifier), the
 * discount was not created via our flow, so we reject attribution. This
 * prevents a manually-created provider coupon from being attributed to a
 * local promo that was never connected to it.
 */
export function discountEvidenceMatches(args: {
  promo: Doc<'promo_codes'>;
  appliedDiscountIdentifier?: string;
  appliedPercentage?: number;
}): boolean {
  const configuredIdentifier = args.promo.revenueCatDiscountIdentifier;
  if (!configuredIdentifier) {
    return false;
  }
  if (!args.appliedDiscountIdentifier || args.appliedDiscountIdentifier !== configuredIdentifier) {
    return false;
  }
  if (args.promo.discountPercent != null && args.appliedPercentage != null) {
    const normalizedApplied = normalizeDiscountPercentage(args.appliedPercentage);
    if (normalizedApplied === undefined || normalizedApplied !== args.promo.discountPercent) {
      return false;
    }
  }
  return true;
}

/**
 * Consume a pending discount claim for a granted purchase. Called from the
 * purchase grant path after a store_purchase row exists.
 *
 * Re-checks every guard before attributing, because the webhook can arrive
 * after the promo was deactivated, expired, edited, or exhausted:
 *  - claim is still pending and not expired
 *  - promo exists, is active, and is within its schedule window
 *  - product restriction matches the purchase product
 *  - global usage cap not exceeded
 *  - per-user cap not exceeded (consumed claims + other active pending claims
 *    for this user+promo, excluding this claim)
 *  - RevenueCat provisioning status is `provisioned` (not pending/failed/disabled)
 *  - webhook `discount_identifier` matches `promo.revenueCatDiscountIdentifier`
 *  - applied percentage matches the configured percentage when both present
 *
 * If any guard fails, the claim is marked `rejected` (or `expired` for time
 * based failures) and the purchase is NOT attributed, NOT incremented, and
 * NO commission is recorded. The purchase still grants tokens normally
 * (handled by the caller); only the affiliate attribution is skipped.
 *
 * Idempotent: if no pending claim exists (native purchase, expired/already
 * consumed claim), returns silently. Replays never reach here because
 * grantConsumablePurchase returns early on an existing store_purchase.
 */
export async function consumeDiscountClaimForPurchase(
  ctx: MutationCtx,
  args: {
    purchaserAccountId: string;
    productKey: string;
    purchaseId: Id<'store_purchases'>;
    priceAmountMicros?: number;
    currencyCode?: string;
    discountIdentifier?: string;
    discountPercentage?: number;
    now: number;
  }
): Promise<void> {
  const claim = await findActivePendingClaimForPurchase(
    ctx,
    args.purchaserAccountId,
    args.productKey,
    args.now
  );
  if (!claim) {
    return;
  }

  // SAFETY: promoCodeId indexes promo_codes; null means the promo row was deleted.
  const promo = (await ctx.db.get(claim.promoCodeId)) as Doc<'promo_codes'> | null;
  if (!promo) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_EXPIRED,
      consumedAt: args.now,
    });
    return;
  }

  // Re-check: promo must be active and within schedule.
  if (promo.active === false) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_REJECTED,
      consumedAt: args.now,
    });
    return;
  }
  if (promo.activeFrom != null && args.now < promo.activeFrom) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_REJECTED,
      consumedAt: args.now,
    });
    return;
  }
  if (promo.activeTo != null && args.now > promo.activeTo) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_EXPIRED,
      consumedAt: args.now,
    });
    return;
  }

  // Re-check: product restriction.
  const productCheck = evaluateDiscountProductRestriction({
    rewardType: promo.rewardType,
    promoProductKey: promo.productKey,
    requestedProductKey: args.productKey,
  });
  if (!productCheck.ok) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_REJECTED,
      consumedAt: args.now,
    });
    return;
  }

  // Re-check: global usage cap + schedule. We pass a large perUserLimit here
  // because the per-user cap is enforced separately below with claim-aware
  // counting (the global evaluatePromoRedemption treats perUserLimit=0 as
  // "zero redemptions allowed", which would always fail).
  const usedCount = promo.usedCount ?? 0;
  const usageCap = promo.usageCap;
  const promoCheck = evaluatePromoRedemption({
    // We already returned early if promo.active === false, so it is safe to
    // pass true here. Using `promo.active !== false` would trigger a TS
    // narrowing error since the type is already `true | undefined` at this
    // point.
    active: true,
    now: args.now,
    activeFrom: promo.activeFrom,
    activeTo: promo.activeTo,
    usedCount,
    usageCap,
    userRedemptionCount: 0,
    perUserLimit: Number.MAX_SAFE_INTEGER,
  });
  if (!promoCheck.ok) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_REJECTED,
      consumedAt: args.now,
    });
    return;
  }

  // Re-check: per-user cap. Count consumed claims + active pending claims for
  // this user+promo, EXCLUDING this claim. Convex mutation serialization makes
  // the global usedCount increment safe against concurrent webhooks.
  const perUserLimit = promo.perUserLimit ?? 1;
  if (perUserLimit > 0) {
    const userClaims = await ctx.db
      .query('promo_discount_claims')
      .withIndex('by_user_promo', (q) => q.eq('userId', claim.userId).eq('promoCodeId', promo._id))
      .collect();
    const otherActiveOrConsumed = userClaims.filter(
      (c) =>
        c._id !== claim._id &&
        (c.status === DISCOUNT_CLAIM_STATUS_CONSUMED ||
          (c.status === DISCOUNT_CLAIM_STATUS_PENDING && c.expiresAt > args.now))
    ).length;
    if (otherActiveOrConsumed >= perUserLimit) {
      await ctx.db.patch(claim._id, {
        status: DISCOUNT_CLAIM_STATUS_REJECTED,
        consumedAt: args.now,
      });
      return;
    }
  }

  // Re-check: provider provisioning must be complete. A pending/failed/disabled
  // promo must never be attributed.
  if (promo.revenueCatProvisioningStatus !== 'provisioned') {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_REJECTED,
      consumedAt: args.now,
    });
    return;
  }

  // Re-check: webhook discount evidence must match the configured discount.
  if (
    !discountEvidenceMatches({
      promo,
      appliedDiscountIdentifier: args.discountIdentifier,
      appliedPercentage: args.discountPercentage,
    })
  ) {
    await ctx.db.patch(claim._id, {
      status: DISCOUNT_CLAIM_STATUS_REJECTED,
      consumedAt: args.now,
    });
    return;
  }

  // All guards passed: attribute the purchase.
  const commissionMicros = computePurchaseCommissionMicros({
    priceAmountMicros: args.priceAmountMicros,
    commissionPercent: promo.commissionPercent,
  });

  await ctx.db.patch(args.purchaseId, {
    promoCodeId: promo._id,
    priceAmountMicros: args.priceAmountMicros ?? undefined,
    currencyCode: args.currencyCode,
    commissionAmountMicros: commissionMicros,
  });

  await ctx.db.patch(claim._id, {
    status: DISCOUNT_CLAIM_STATUS_CONSUMED,
    consumedPurchaseId: args.purchaseId,
    consumedAt: args.now,
  });

  // Increment usage exactly once per consumed claim. Convex serializes
  // mutations, so concurrent webhooks for the same promo cannot both read the
  // same usedCount and double-attribute.
  await ctx.db.patch(promo._id, { usedCount: usedCount + 1 });
}
