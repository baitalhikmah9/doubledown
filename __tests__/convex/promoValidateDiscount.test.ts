import { describe, expect, it } from '@jest/globals';
import { validateDiscountCode } from '@/convex/promo';
import { getConvexHandler } from '../helpers/convexHandler';
import {
  createConvexTestCtx,
  purchaserAccountDoc,
  userDoc,
  type ConvexDoc,
} from '../helpers/convexTestCtx';

type ValidateArgs = { code: string; productKey: string };
type ValidateResult = {
  success: boolean;
  error?: string;
  discountPercent?: number;
  productKey?: string;
  expiresAt?: number;
};

const handler = getConvexHandler<
  ReturnType<typeof createConvexTestCtx>,
  ValidateArgs,
  ValidateResult
>(validateDiscountCode);

const basePromo: ConvexDoc = {
  _id: 'promo_1',
  code: 'mikhail10',
  rewardType: 'discount',
  rewardAmount: 0,
  usageCap: 0,
  usedCount: 0,
  perUserLimit: 1,
  active: true,
  discountPercent: 10,
  productKey: 'bundle_50',
  commissionPercent: 10,
  revenueCatProvisioningStatus: 'provisioned',
  revenueCatDiscountIdentifier: 'promo_mikhail10',
};

function authedCtx(args: {
  promo?: ConvexDoc | null;
  redemptions?: ConvexDoc[];
  claims?: ConvexDoc[];
  rateRow?: ConvexDoc | null;
}) {
  const user = userDoc({
    id: 'users_1',
    clerkId: 'clerk_fan',
    email: 'fan@example.com',
    canonicalPurchaserAccountId: 'purchaser_1',
  });
  const purchaser = purchaserAccountDoc({
    appUserId: 'purchaser_1',
    linkedUserId: 'users_1',
  });
  const promos = args.promo === null ? [] : args.promo ? [args.promo] : [basePromo];
  return createConvexTestCtx({
    identity: { subject: 'clerk_fan', email: 'fan@example.com' },
    tables: {
      users: [user],
      purchaser_accounts: [purchaser],
      promo_codes: promos,
      promo_redemptions: args.redemptions ?? [],
      promo_discount_claims: args.claims ?? [],
      promo_redeem_rates: args.rateRow ? [args.rateRow] : [],
    },
  });
}

describe('promo.validateDiscountCode', () => {
  it('validates a discount code for the matching bundle and records a pending claim', async () => {
    const ctx = authedCtx({});
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toMatchObject({
      success: true,
      discountPercent: 10,
      productKey: 'bundle_50',
    });
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    const claimInsert = ctx.inserts.find((i) => i.table === 'promo_discount_claims');
    expect(claimInsert).toBeDefined();
    expect(claimInsert?.doc).toMatchObject({
      promoCodeId: 'promo_1',
      userId: 'users_1',
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      status: 'pending',
    });
  });

  it('rejects a discount code for a non-matching bundle', async () => {
    const ctx = authedCtx({});
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_30',
    });
    expect(result).toEqual({ success: false, error: 'discount_product_mismatch' });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
  });

  it('rejects an expired discount code', async () => {
    const ctx = authedCtx({
      promo: { ...basePromo, activeTo: Date.now() - 1000 },
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'expired' });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
  });

  // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
  it('rejects a token reward code as invalid (not a discount code)', async () => {
    const ctx = authedCtx({
      promo: { ...basePromo, rewardType: 'tokens', rewardAmount: 10 },
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('rejects when the per-user cap is already reached via a consumed claim', async () => {
    const now = Date.now();
    const ctx = authedCtx({
      promo: { ...basePromo, perUserLimit: 1 },
      claims: [
        {
          _id: 'claim_consumed',
          status: 'consumed',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
          userId: 'users_1',
          promoCodeId: 'promo_1',
        },
      ],
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'per_user_cap' });
  });

  it('rejects when the per-user cap is reached via a different-product pending claim', async () => {
    const now = Date.now();
    const ctx = authedCtx({
      promo: { ...basePromo, perUserLimit: 1 },
      claims: [
        {
          _id: 'claim_other_product',
          status: 'pending',
          productKey: 'bundle_30',
          expiresAt: now + 1000,
          userId: 'users_1',
          promoCodeId: 'promo_1',
        },
      ],
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'per_user_cap' });
  });

  it('refreshes an existing pending claim instead of inserting a duplicate', async () => {
    const now = Date.now();
    const ctx = authedCtx({
      promo: { ...basePromo, perUserLimit: 5 },
      claims: [
        {
          _id: 'claim_existing',
          status: 'pending',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
          claimedAt: now - 100,
          userId: 'users_1',
          promoCodeId: 'promo_1',
        },
      ],
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toMatchObject({ success: true });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
    expect(ctx.patches.find((p) => p.id === 'claim_existing')).toBeDefined();
    expect(ctx.patches.find((p) => p.id === 'claim_existing')?.patch.expiresAt).toBeGreaterThan(now);
  });

  it('idempotently refreshes the same pending claim even when perUserLimit=1', async () => {
    const now = Date.now();
    const ctx = authedCtx({
      promo: { ...basePromo, perUserLimit: 1 },
      claims: [
        {
          _id: 'claim_mine',
          status: 'pending',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
          claimedAt: now - 100,
          userId: 'users_1',
          promoCodeId: 'promo_1',
        },
      ],
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toMatchObject({ success: true });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
    expect(ctx.patches.find((p) => p.id === 'claim_mine')).toBeDefined();
  });

  it('rejects a discount code that is not yet provisioned in RevenueCat', async () => {
    const ctx = authedCtx({
      promo: { ...basePromo, revenueCatProvisioningStatus: 'pending' },
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('rejects a discount code whose provisioning failed', async () => {
    const ctx = authedCtx({
      promo: { ...basePromo, revenueCatProvisioningStatus: 'failed' },
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('rejects an unknown code', async () => {
    const ctx = authedCtx({ promo: null });
    const result = await handler(ctx, {
      code: 'unknown',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('enforces the usage cap', async () => {
    const ctx = authedCtx({
      promo: { ...basePromo, usageCap: 5, usedCount: 5 },
    });
    const result = await handler(ctx, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });
    expect(result).toEqual({ success: false, error: 'usage_cap' });
  });
});
