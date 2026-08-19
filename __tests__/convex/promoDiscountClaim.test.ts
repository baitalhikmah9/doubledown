import { describe, expect, it, jest } from '@jest/globals';
import {
  DISCOUNT_CLAIM_TTL_MS,
  DISCOUNT_CLAIM_STATUS_PENDING,
  DISCOUNT_CLAIM_STATUS_CONSUMED,
  DISCOUNT_CLAIM_STATUS_EXPIRED,
  DISCOUNT_CLAIM_STATUS_REJECTED,
  computePurchaseCommissionMicros,
  consumeDiscountClaimForPurchase,
  findActivePendingClaimForPurchase,
  priceToMicros,
} from '@/convex/lib/promoDiscountClaim';

describe('priceToMicros', () => {
  it('converts float prices to integer micros', () => {
    expect(priceToMicros(9.99)).toBe(9_990_000);
    expect(priceToMicros(0)).toBe(0);
    expect(priceToMicros(8)).toBe(8_000_000);
  });

  it('rejects non-finite or negative prices', () => {
    expect(priceToMicros(undefined)).toBeNull();
    expect(priceToMicros(NaN)).toBeNull();
    expect(priceToMicros(Infinity)).toBeNull();
    expect(priceToMicros(-1)).toBeNull();
    expect(priceToMicros('9.99')).toBeNull();
  });
});

describe('computePurchaseCommissionMicros', () => {
  it('computes commission from the actual charged amount', () => {
    // £8.00 at 10% = £0.80
    expect(computePurchaseCommissionMicros({ priceAmountMicros: 8_000_000, commissionPercent: 10 })).toBe(800_000);
  });

  it('returns undefined when price is missing so earnings are never invented', () => {
    expect(computePurchaseCommissionMicros({ commissionPercent: 10 })).toBeUndefined();
    expect(computePurchaseCommissionMicros({ priceAmountMicros: undefined, commissionPercent: 10 })).toBeUndefined();
  });

  it('returns undefined when commission percent is missing or invalid', () => {
    expect(computePurchaseCommissionMicros({ priceAmountMicros: 8_000_000 })).toBeUndefined();
    expect(computePurchaseCommissionMicros({ priceAmountMicros: 8_000_000, commissionPercent: -1 })).toBeUndefined();
  });

  it('rejects non-integer price micros', () => {
    expect(computePurchaseCommissionMicros({ priceAmountMicros: 8.5, commissionPercent: 10 })).toBeUndefined();
  });
});

describe('findActivePendingClaimForPurchase', () => {
  function mockCtx(rowsByStatus: Record<string, unknown[]>) {
    const patches: { id: unknown; patch: Record<string, unknown> }[] = [];
    const db = {
      patch: jest.fn(async (id: unknown, patch: Record<string, unknown>) => {
        patches.push({ id, patch });
      }),
      query: jest.fn((table: string) => ({
        withIndex: (_index: string, rangeFn: (q: { eq: (f: string, v: unknown) => unknown }) => void) => {
          const eqs: [string, unknown][] = [];
          const q = {
            eq(field: string, value: unknown) {
              eqs.push([field, value]);
              return q;
            },
          };
          rangeFn(q);
          const status = eqs.find(([f]) => f === 'status')?.[1] as string;
          return { collect: async () => rowsByStatus[`${table}:${status}`] ?? [] };
        },
      })),
    };
    return { db, patches };
  }

  it('returns the most recent non-expired pending claim', async () => {
    const now = 1_000_000;
    const ctx = mockCtx({
      'promo_discount_claims:pending': [
        { _id: 'claim_a', promoCodeId: 'promo_1', claimedAt: now - 100, expiresAt: now + 1000, productKey: 'bundle_50' },
        { _id: 'claim_b', promoCodeId: 'promo_1', claimedAt: now - 50, expiresAt: now + 1000, productKey: 'bundle_50' },
      ],
    });
    const claim = await findActivePendingClaimForPurchase(ctx as any, 'purchaser_1', 'bundle_50', now);
    expect((claim as any)?._id).toBe('claim_b');
    expect(ctx.patches).toEqual([]);
  });

  it('expires stale pending claims and returns null when all are expired', async () => {
    const now = 1_000_000;
    const ctx = mockCtx({
      'promo_discount_claims:pending': [
        { _id: 'claim_old', promoCodeId: 'promo_1', claimedAt: now - 5000, expiresAt: now - 100, productKey: 'bundle_50' },
      ],
    });
    const claim = await findActivePendingClaimForPurchase(ctx as any, 'purchaser_1', 'bundle_50', now);
    expect(claim).toBeNull();
    expect(ctx.patches).toEqual([{ id: 'claim_old', patch: { status: 'expired' } }]);
  });
});

describe('consumeDiscountClaimForPurchase', () => {
  function mockConsumeCtx(args: {
    claim?: Record<string, unknown> | null;
    promo?: Record<string, unknown> | null;
    userClaims?: Record<string, unknown>[];
  }) {
    const patches: { id: unknown; patch: Record<string, unknown> }[] = [];
    const inserts: { table: string; doc: Record<string, unknown> }[] = [];
    const db = {
      get: jest.fn(async (id: unknown) =>
        id === 'promo_1' ? args.promo : id === 'claim_1' ? args.claim : null
      ),
      patch: jest.fn(async (id: unknown, patch: Record<string, unknown>) => {
        patches.push({ id, patch });
      }),
      insert: jest.fn(async (table: string, doc: Record<string, unknown>) => {
        inserts.push({ table, doc });
        return 'new_id';
      }),
      query: jest.fn((table: string) => ({
        withIndex: (index: string, rangeFn: (q: { eq: (f: string, v: unknown) => unknown }) => void) => {
          const eqs: [string, unknown][] = [];
          const q = {
            eq(field: string, value: unknown) {
              eqs.push([field, value]);
              return q;
            },
          };
          rangeFn(q);
          const status = eqs.find(([f]) => f === 'status')?.[1] as string;
          if (table === 'promo_discount_claims') {
            if (index === 'by_purchaser_product_status' && status === 'pending') {
              return { collect: async () => (args.claim ? [args.claim] : []) };
            }
            if (index === 'by_user_promo') {
              return { collect: async () => args.userClaims ?? [] };
            }
          }
          return { collect: async () => [] };
        },
      })),
    };
    return { db, patches, inserts };
  }

  const provisionedPromo = {
    _id: 'promo_1',
    usedCount: 3,
    commissionPercent: 10,
    active: true,
    rewardType: 'discount',
    productKey: 'bundle_50',
    discountPercent: 10,
    usageCap: 0,
    revenueCatProvisioningStatus: 'provisioned',
    revenueCatDiscountIdentifier: 'promo_mikhail10',
  };

  it('attributes the purchase when discount evidence matches and increments usage once', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo },
      userClaims: [
        {
          _id: 'claim_1',
          status: 'pending',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
        },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      priceAmountMicros: 8_000_000,
      currencyCode: 'GBP',
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });

    // store_purchase patched with promoCodeId, price, currency, commission.
    expect(ctx.patches).toContainEqual({
      id: 'purchase_1',
      patch: {
        promoCodeId: 'promo_1',
        priceAmountMicros: 8_000_000,
        currencyCode: 'GBP',
        commissionAmountMicros: 800_000,
      },
    });
    // claim marked consumed.
    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: {
        status: DISCOUNT_CLAIM_STATUS_CONSUMED,
        consumedPurchaseId: 'purchase_1',
        consumedAt: now,
      },
    });
    // promo usedCount incremented exactly once.
    expect(ctx.patches).toContainEqual({ id: 'promo_1', patch: { usedCount: 4 } });
  });

  it('rejects attribution when the webhook discount_identifier does not match', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      priceAmountMicros: 8_000_000,
      currencyCode: 'GBP',
      discountIdentifier: 'wrong_identifier',
      discountPercentage: 10,
      now,
    });

    // Claim rejected, purchase NOT attributed, usage NOT incremented.
    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_REJECTED, consumedAt: now },
    });
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
    expect(ctx.patches.find((p) => p.id === 'promo_1' && (p.patch as any).usedCount)).toBeUndefined();
  });

  it('rejects attribution when the webhook discount_identifier is missing', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      priceAmountMicros: 8_000_000,
      currencyCode: 'GBP',
      now,
    });

    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_REJECTED, consumedAt: now },
    });
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
  });

  it('rejects attribution when the applied percentage does not match', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      priceAmountMicros: 8_000_000,
      currencyCode: 'GBP',
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 50,
      now,
    });

    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_REJECTED, consumedAt: now },
    });
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
  });

  it('rejects attribution when the promo is not provisioned', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo, revenueCatProvisioningStatus: 'pending' },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });

    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_REJECTED, consumedAt: now },
    });
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
  });

  it('rejects attribution when the promo is inactive (deactivated)', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo, active: false, revenueCatProvisioningStatus: 'disabled' },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });

    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_REJECTED, consumedAt: now },
    });
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
  });

  it('rejects attribution when the per-user cap is exceeded by a consumed claim', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo, perUserLimit: 1 },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
        { _id: 'claim_other', status: 'consumed', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });

    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });

    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_REJECTED, consumedAt: now },
    });
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
  });

  it('is a no-op when no pending claim exists (native purchase)', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({ claim: null, promo: null });
    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      priceAmountMicros: 8_000_000,
      currencyCode: 'GBP',
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });
    expect(ctx.patches).toEqual([]);
    expect(ctx.inserts).toEqual([]);
  });

  it('records commission as undefined when price is missing', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        userId: 'users_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: { ...provisionedPromo, usedCount: 0 },
      userClaims: [
        { _id: 'claim_1', status: 'pending', productKey: 'bundle_50', expiresAt: now + 1000 },
      ],
    });
    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });
    const purchasePatch = ctx.patches.find((p) => p.id === 'purchase_1');
    expect(purchasePatch?.patch.commissionAmountMicros).toBeUndefined();
    expect(purchasePatch?.patch.priceAmountMicros).toBeUndefined();
  });

  it('expires the claim if the promo no longer exists', async () => {
    const now = 1_000_000;
    const ctx = mockConsumeCtx({
      claim: {
        _id: 'claim_1',
        promoCodeId: 'promo_1',
        claimedAt: now - 100,
        expiresAt: now + 1000,
        productKey: 'bundle_50',
      },
      promo: null,
    });
    await consumeDiscountClaimForPurchase(ctx as any, {
      purchaserAccountId: 'purchaser_1',
      productKey: 'bundle_50',
      purchaseId: 'purchase_1' as any,
      discountIdentifier: 'promo_mikhail10',
      discountPercentage: 10,
      now,
    });
    expect(ctx.patches).toContainEqual({
      id: 'claim_1',
      patch: { status: DISCOUNT_CLAIM_STATUS_EXPIRED, consumedAt: now },
    });
    // purchase should NOT be attributed to a missing promo.
    expect(ctx.patches.find((p) => p.id === 'purchase_1')).toBeUndefined();
  });
});

describe('DISCOUNT_CLAIM_TTL_MS', () => {
  it('is a positive millisecond window', () => {
    expect(DISCOUNT_CLAIM_TTL_MS).toBeGreaterThan(0);
    expect(DISCOUNT_CLAIM_STATUS_PENDING).toBe('pending');
    expect(DISCOUNT_CLAIM_STATUS_CONSUMED).toBe('consumed');
    expect(DISCOUNT_CLAIM_STATUS_EXPIRED).toBe('expired');
  });
});
