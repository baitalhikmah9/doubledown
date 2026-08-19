import { mutation } from './_generated/server';
import { v } from 'convex/values';
import {
  evaluateDiscountProductRestriction,
  evaluatePromoAccountRestriction,
  evaluatePromoRedemption,
  evaluatePromoRewardType,
  normalizePromoCode,
} from './lib/promoRules';
import {
  appendPromoRedeemAttempt,
  evaluatePromoRedeemRateGate,
  prunePromoRedeemAttempts,
} from './lib/promoRedeemRateLimit';
import { ensureWalletDoc } from './lib/ensureWallet';
import { requireUser } from './lib/auth';
import { ensureCanonicalPurchaserAccountForUser } from './lib/purchaserAccounts';
import {
  DISCOUNT_CLAIM_STATUS_PENDING,
  DISCOUNT_CLAIM_STATUS_CONSUMED,
  DISCOUNT_CLAIM_TTL_MS,
} from './lib/promoDiscountClaim';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

async function loadPromoRedeemAttempts(ctx: MutationCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('promo_redeem_rates')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

async function recordFailedPromoAttempt(
  ctx: MutationCtx,
  userId: Id<'users'>,
  now: number
) {
  const existing = await loadPromoRedeemAttempts(ctx, userId);
  const pruned = prunePromoRedeemAttempts(existing?.attemptTimestamps ?? [], now);
  const { next, recorded } = appendPromoRedeemAttempt(pruned, now);

  if (!recorded && existing && pruned.length === existing.attemptTimestamps.length) {
    return;
  }

  if (existing) {
    await ctx.db.patch(existing._id, { attemptTimestamps: next });
    return;
  }

  if (recorded) {
    await ctx.db.insert('promo_redeem_rates', {
      userId,
      attemptTimestamps: next,
    });
  }
}

export const redeemCode = mutation({
  args: {
    code: v.string(),
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const purchaserAccount = await ensureCanonicalPurchaserAccountForUser(ctx, user);
    const now = Date.now();

    const rateRow = await loadPromoRedeemAttempts(ctx, user._id);
    const prunedAttempts = prunePromoRedeemAttempts(rateRow?.attemptTimestamps ?? [], now);
    if (rateRow && prunedAttempts.length !== rateRow.attemptTimestamps.length) {
      await ctx.db.patch(rateRow._id, { attemptTimestamps: prunedAttempts });
    }
    const rateGate = evaluatePromoRedeemRateGate(prunedAttempts, now);
    if (!rateGate.allowed) {
      return {
        success: false as const,
        error: 'rate_limited' as const,
        retryAfterMs: rateGate.retryAfterMs,
      };
    }

    const normalized = normalizePromoCode(args.code);

    const promo = await ctx.db
      .query('promo_codes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();

    if (!promo) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: 'invalid_code' };
    }

    const usedCount = promo.usedCount ?? 0;
    const perUserLimit = promo.perUserLimit ?? 1;
    const active = promo.active !== false;

    const userRedemptions = await ctx.db
      .query('promo_redemptions')
      .withIndex('by_user_promo', (q) => q.eq('userId', user._id).eq('promoCodeId', promo._id))
      .collect();
    const userRedemptionCount = userRedemptions.length;
    const accountCheck = evaluatePromoAccountRestriction({
      redemptionScope: promo.redemptionScope,
      restrictedToUserId: promo.restrictedToUserId,
      restrictedToPurchaserAccountId: promo.restrictedToPurchaserAccountId,
      currentUserId: user._id,
      currentPurchaserAccountId: purchaserAccount?.appUserId ?? null,
    });

    if (!accountCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: accountCheck.reason };
    }

    const promoCheck = evaluatePromoRedemption({
      active,
      now,
      activeFrom: promo.activeFrom,
      activeTo: promo.activeTo,
      usedCount,
      usageCap: promo.usageCap,
      userRedemptionCount,
      perUserLimit,
    });

    if (!promoCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: promoCheck.reason };
    }

    const rewardCheck = evaluatePromoRewardType(promo.rewardType);
    if (!rewardCheck.ok) {
      return { success: false as const, error: rewardCheck.reason };
    }

    // Discount codes never grant tokens via this path. They are validated and
    // claimed through promo.applyPromoCode (the unified web coupon path), which
    // creates a pending claim for the configured product.
    if (promo.rewardType === 'discount') {
      return { success: false as const, error: 'discount_checkout_unavailable' };
    }

    if (!purchaserAccount) {
      throw new Error('Purchaser account creation failed');
    }

    const wallet = await ensureWalletDoc(ctx, purchaserAccount.appUserId, user._id);
    if (perUserLimit > 1 && !args.clientRequestId?.trim()) {
      return { success: false as const, error: 'idempotency_required' };
    }

    const idempotencyKey =
      perUserLimit > 1
        ? `promo:${user._id}:${promo._id}:${args.clientRequestId!.trim()}`
        : `promo:${user._id}:${promo._id}`;

    const existingTx = await ctx.db
      .query('wallet_transactions')
      .withIndex('by_wallet_idempotency', (q) =>
        q.eq('walletId', wallet._id).eq('idempotencyKey', idempotencyKey)
      )
      .unique();

    if (existingTx) {
      return {
        success: true as const,
        tokensGranted: promo.rewardAmount,
        duplicate: true as const,
      };
    }

    const grantAmount = promo.rewardAmount;
    const txNow = Date.now();

    const transactionId = await ctx.db.insert('wallet_transactions', {
      walletId: wallet._id,
      type: 'promo_redemption',
      amount: grantAmount,
      createdAt: txNow,
      status: 'posted',
      source: 'promo',
      idempotencyKey,
      metadata: { code: normalized, promoCodeId: promo._id },
    });

    await ctx.db.patch(wallet._id, { balance: wallet.balance + grantAmount });
    await ctx.db.insert('promo_redemptions', {
      promoCodeId: promo._id,
      userId: user._id,
      redeemedAt: txNow,
      transactionId,
    });

    await ctx.db.patch(promo._id, { usedCount: usedCount + 1 });

    return { success: true as const, tokensGranted: grantAmount };
  },
});

/**
 * Validate a discount promo code for a specific token bundle and record a
 * pending claim scoped to the signed-in user's canonical purchaser account.
 *
 * This never grants tokens. The web checkout passes the code to RevenueCat
 * Web Billing as `discountCode` with `showDiscountCodeField: false` so the
 * user cannot replace the validated code in checkout. The actual percentage
 * discount is applied by RevenueCat because the admin flow provisions the
 * discount + code in RevenueCat automatically. The pending claim lets the
 * webhook path attribute the eventual purchase to this promo, increment usage
 * once, and compute commission from the real post-discount charged amount,
 * but only when the webhook confirms the configured discount was applied.
 *
 * Note: the unified web coupon entry point is promo.applyPromoCode, which
 * branches on reward type and calls this same claim-creation logic for
 * discount codes. This mutation remains for backward compatibility.
 *
 * Re-validating the same active pending claim refreshes its expiry
 * idempotently, even when perUserLimit=1, because the existing claim is
 * excluded from the cap count during a refresh.
 */
export const validateDiscountCode = mutation({
  args: {
    code: v.string(),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const purchaserAccount = await ensureCanonicalPurchaserAccountForUser(ctx, user);
    if (!purchaserAccount) {
      throw new Error('Purchaser account creation failed');
    }
    const now = Date.now();

    const rateRow = await loadPromoRedeemAttempts(ctx, user._id);
    const prunedAttempts = prunePromoRedeemAttempts(rateRow?.attemptTimestamps ?? [], now);
    if (rateRow && prunedAttempts.length !== rateRow.attemptTimestamps.length) {
      await ctx.db.patch(rateRow._id, { attemptTimestamps: prunedAttempts });
    }
    const rateGate = evaluatePromoRedeemRateGate(prunedAttempts, now);
    if (!rateGate.allowed) {
      return {
        success: false as const,
        error: 'rate_limited' as const,
        retryAfterMs: rateGate.retryAfterMs,
      };
    }

    const normalized = normalizePromoCode(args.code);
    const promo = await ctx.db
      .query('promo_codes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();

    if (!promo) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: 'invalid_code' };
    }

    if (promo.rewardType !== 'discount') {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: 'invalid_code' };
    }

    // A discount code is only usable once RevenueCat provisioning is complete.
    // pending/failed/disabled codes must never be presented as usable.
    if (promo.revenueCatProvisioningStatus !== 'provisioned') {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: 'invalid_code' };
    }

    const usedCount = promo.usedCount ?? 0;
    const perUserLimit = promo.perUserLimit ?? 1;
    const active = promo.active !== false;

    const userRedemptions = await ctx.db
      .query('promo_redemptions')
      .withIndex('by_user_promo', (q) => q.eq('userId', user._id).eq('promoCodeId', promo._id))
      .collect();
    const userRedemptionCount = userRedemptions.length;

    // All claims for this promo by this user. We need both the count for the
    // per-user cap and the existing matching pending claim for idempotent
    // refresh.
    const userClaims = await ctx.db
      .query('promo_discount_claims')
      .withIndex('by_user_promo', (q) => q.eq('userId', user._id).eq('promoCodeId', promo._id))
      .collect();

    // Find an existing active pending claim for this exact product. This is
    // the claim a refresh would update, so it is excluded from the cap count.
    const existingMatchingPending = userClaims.find(
      (claim) =>
        claim.status === DISCOUNT_CLAIM_STATUS_PENDING &&
        claim.productKey === args.productKey &&
        claim.expiresAt > now
    );

    // Per-user cap: consumed claims + active pending claims, EXCLUDING the
    // matching pending claim being refreshed (so a refresh at perUserLimit=1
    // succeeds idempotently).
    const otherActiveOrConsumed = userClaims.filter(
      (claim) =>
        claim._id !== existingMatchingPending?._id &&
        (claim.status === DISCOUNT_CLAIM_STATUS_CONSUMED ||
          (claim.status === DISCOUNT_CLAIM_STATUS_PENDING && claim.expiresAt > now))
    ).length;

    const accountCheck = evaluatePromoAccountRestriction({
      redemptionScope: promo.redemptionScope,
      restrictedToUserId: promo.restrictedToUserId,
      restrictedToPurchaserAccountId: promo.restrictedToPurchaserAccountId,
      currentUserId: user._id,
      currentPurchaserAccountId: purchaserAccount.appUserId,
    });
    if (!accountCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: accountCheck.reason };
    }

    const promoCheck = evaluatePromoRedemption({
      active,
      now,
      activeFrom: promo.activeFrom,
      activeTo: promo.activeTo,
      usedCount,
      usageCap: promo.usageCap,
      userRedemptionCount,
      perUserLimit,
    });
    if (!promoCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: promoCheck.reason };
    }

    const rewardCheck = evaluatePromoRewardType(promo.rewardType);
    if (!rewardCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: rewardCheck.reason };
    }

    const productCheck = evaluateDiscountProductRestriction({
      rewardType: promo.rewardType,
      promoProductKey: promo.productKey,
      requestedProductKey: args.productKey,
    });
    if (!productCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: productCheck.reason };
    }

    if (perUserLimit > 0 && userRedemptionCount + otherActiveOrConsumed >= perUserLimit) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: 'per_user_cap' };
    }

    const expiresAt = now + DISCOUNT_CLAIM_TTL_MS;

    if (existingMatchingPending) {
      // Idempotent refresh: update the existing claim's expiry without
      // inserting a duplicate or counting it against the cap.
      await ctx.db.patch(existingMatchingPending._id, { expiresAt, claimedAt: now });
    } else {
      await ctx.db.insert('promo_discount_claims', {
        promoCodeId: promo._id,
        userId: user._id,
        purchaserAccountId: purchaserAccount.appUserId,
        productKey: args.productKey,
        claimedAt: now,
        expiresAt,
        status: DISCOUNT_CLAIM_STATUS_PENDING,
      });
    }

    return {
      success: true as const,
      discountPercent: promo.discountPercent ?? 0,
      productKey: promo.productKey ?? args.productKey,
      expiresAt,
    };
  },
});

/**
 * Unified web coupon entry point. The user enters a code once; the server
 * determines whether it is a token reward (granted immediately) or a
 * product-scoped discount (creates a pending claim and returns the matching
 * bundle so the client knows which bundle to buy).
 *
 * Returns a discriminated union:
 *  - `{ success: true, kind: 'tokens', tokensGranted }` for token rewards.
 *  - `{ success: true, kind: 'discount', discountPercent, productKey, expiresAt }`
 *    for discount codes. The client passes the code to checkout for that
 *    bundle; the webhook is authoritative for attribution.
 *  - `{ success: false, error, ... }` on any failure.
 *
 * This replaces the separate REDEEM CODE + DISCOUNT CODE boxes with a single
 * input. The server knows `promo.productKey` for discounts, so the user never
 * has to select a bundle.
 */
export const applyPromoCode = mutation({
  args: {
    code: v.string(),
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const purchaserAccount = await ensureCanonicalPurchaserAccountForUser(ctx, user);
    if (!purchaserAccount) {
      throw new Error('Purchaser account creation failed');
    }
    const now = Date.now();

    const rateRow = await loadPromoRedeemAttempts(ctx, user._id);
    const prunedAttempts = prunePromoRedeemAttempts(rateRow?.attemptTimestamps ?? [], now);
    if (rateRow && prunedAttempts.length !== rateRow.attemptTimestamps.length) {
      await ctx.db.patch(rateRow._id, { attemptTimestamps: prunedAttempts });
    }
    const rateGate = evaluatePromoRedeemRateGate(prunedAttempts, now);
    if (!rateGate.allowed) {
      return {
        success: false as const,
        error: 'rate_limited' as const,
        retryAfterMs: rateGate.retryAfterMs,
      };
    }

    const normalized = normalizePromoCode(args.code);
    const promo = await ctx.db
      .query('promo_codes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();

    if (!promo) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: 'invalid_code' };
    }

    const accountCheck = evaluatePromoAccountRestriction({
      redemptionScope: promo.redemptionScope,
      restrictedToUserId: promo.restrictedToUserId,
      restrictedToPurchaserAccountId: promo.restrictedToPurchaserAccountId,
      currentUserId: user._id,
      currentPurchaserAccountId: purchaserAccount.appUserId,
    });
    if (!accountCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: accountCheck.reason };
    }

    // Branch on reward type. Discount codes go through the discount claim
    // path; token codes go through the immediate grant path.
    if (promo.rewardType === 'discount') {
      // Discount codes must be provisioned before they are usable.
      if (promo.revenueCatProvisioningStatus !== 'provisioned') {
        await recordFailedPromoAttempt(ctx, user._id, now);
        return { success: false as const, error: 'invalid_code' };
      }

      const usedCount = promo.usedCount ?? 0;
      const perUserLimit = promo.perUserLimit ?? 1;
      const active = promo.active !== false;

      const userRedemptions = await ctx.db
        .query('promo_redemptions')
        .withIndex('by_user_promo', (q) => q.eq('userId', user._id).eq('promoCodeId', promo._id))
        .collect();
      const userRedemptionCount = userRedemptions.length;

      const userClaims = await ctx.db
        .query('promo_discount_claims')
        .withIndex('by_user_promo', (q) => q.eq('userId', user._id).eq('promoCodeId', promo._id))
        .collect();

      const productKey = promo.productKey ?? '';
      const existingMatchingPending = userClaims.find(
        (claim) =>
          claim.status === DISCOUNT_CLAIM_STATUS_PENDING &&
          claim.productKey === productKey &&
          claim.expiresAt > now
      );

      const otherActiveOrConsumed = userClaims.filter(
        (claim) =>
          claim._id !== existingMatchingPending?._id &&
          (claim.status === DISCOUNT_CLAIM_STATUS_CONSUMED ||
            (claim.status === DISCOUNT_CLAIM_STATUS_PENDING && claim.expiresAt > now))
      ).length;

      const promoCheck = evaluatePromoRedemption({
        active,
        now,
        activeFrom: promo.activeFrom,
        activeTo: promo.activeTo,
        usedCount,
        usageCap: promo.usageCap,
        userRedemptionCount,
        perUserLimit,
      });
      if (!promoCheck.ok) {
        await recordFailedPromoAttempt(ctx, user._id, now);
        return { success: false as const, error: promoCheck.reason };
      }

      if (perUserLimit > 0 && userRedemptionCount + otherActiveOrConsumed >= perUserLimit) {
        await recordFailedPromoAttempt(ctx, user._id, now);
        return { success: false as const, error: 'per_user_cap' };
      }

      const expiresAt = now + DISCOUNT_CLAIM_TTL_MS;
      if (existingMatchingPending) {
        await ctx.db.patch(existingMatchingPending._id, { expiresAt, claimedAt: now });
      } else {
        await ctx.db.insert('promo_discount_claims', {
          promoCodeId: promo._id,
          userId: user._id,
          purchaserAccountId: purchaserAccount.appUserId,
          productKey,
          claimedAt: now,
          expiresAt,
          status: DISCOUNT_CLAIM_STATUS_PENDING,
        });
      }

      return {
        success: true as const,
        kind: 'discount' as const,
        discountPercent: promo.discountPercent ?? 0,
        productKey,
        expiresAt,
      };
    }

    // Token reward path: grant immediately (same logic as redeemCode).
    const rewardCheck = evaluatePromoRewardType(promo.rewardType);
    if (!rewardCheck.ok) {
      return { success: false as const, error: rewardCheck.reason };
    }

    const usedCount = promo.usedCount ?? 0;
    const perUserLimit = promo.perUserLimit ?? 1;
    const active = promo.active !== false;

    const userRedemptions = await ctx.db
      .query('promo_redemptions')
      .withIndex('by_user_promo', (q) => q.eq('userId', user._id).eq('promoCodeId', promo._id))
      .collect();
    const userRedemptionCount = userRedemptions.length;

    const promoCheck = evaluatePromoRedemption({
      active,
      now,
      activeFrom: promo.activeFrom,
      activeTo: promo.activeTo,
      usedCount,
      usageCap: promo.usageCap,
      userRedemptionCount,
      perUserLimit,
    });
    if (!promoCheck.ok) {
      await recordFailedPromoAttempt(ctx, user._id, now);
      return { success: false as const, error: promoCheck.reason };
    }

    const wallet = await ensureWalletDoc(ctx, purchaserAccount.appUserId, user._id);
    if (perUserLimit > 1 && !args.clientRequestId?.trim()) {
      return { success: false as const, error: 'idempotency_required' };
    }

    const idempotencyKey =
      perUserLimit > 1
        ? `promo:${user._id}:${promo._id}:${args.clientRequestId!.trim()}`
        : `promo:${user._id}:${promo._id}`;

    const existingTx = await ctx.db
      .query('wallet_transactions')
      .withIndex('by_wallet_idempotency', (q) =>
        q.eq('walletId', wallet._id).eq('idempotencyKey', idempotencyKey)
      )
      .unique();

    if (existingTx) {
      return {
        success: true as const,
        kind: 'tokens' as const,
        tokensGranted: promo.rewardAmount,
        duplicate: true as const,
      };
    }

    const grantAmount = promo.rewardAmount;
    const txNow = Date.now();

    const transactionId = await ctx.db.insert('wallet_transactions', {
      walletId: wallet._id,
      type: 'promo_redemption',
      amount: grantAmount,
      createdAt: txNow,
      status: 'posted',
      source: 'promo',
      idempotencyKey,
      metadata: { code: normalized, promoCodeId: promo._id },
    });

    await ctx.db.patch(wallet._id, { balance: wallet.balance + grantAmount });
    await ctx.db.insert('promo_redemptions', {
      promoCodeId: promo._id,
      userId: user._id,
      redeemedAt: txNow,
      transactionId,
    });

    await ctx.db.patch(promo._id, { usedCount: usedCount + 1 });

    return {
      success: true as const,
      kind: 'tokens' as const,
      tokensGranted: grantAmount,
    };
  },
});
