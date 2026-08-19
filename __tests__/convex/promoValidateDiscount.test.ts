import { describe, expect, it, jest } from '@jest/globals';
import { validateDiscountCode } from '@/convex/promo';
import { requireUser } from '@/convex/lib/auth';

jest.mock('@/convex/lib/auth', () => ({
  requireUser: jest.fn(),
}));

jest.mock('@/convex/lib/purchaserAccounts', () => ({
  ensureCanonicalPurchaserAccountForUser: jest.fn(async () => ({
    appUserId: 'purchaser_1',
  })),
}));

const mockedRequireUser = requireUser as jest.MockedFunction<typeof requireUser>;

function mockValidateCtx(args: {
  promo?: Record<string, unknown> | null;
  redemptions?: unknown[];
  claims?: unknown[];
  rateRow?: Record<string, unknown> | null;
}) {
  const inserts: { table: string; doc: Record<string, unknown> }[] = [];
  const patches: { id: unknown; patch: Record<string, unknown> }[] = [];
  const db = {
    get: jest.fn(async (id: unknown) => (id === 'promo_1' ? args.promo : null)),
    insert: jest.fn(async (table: string, doc: Record<string, unknown>) => {
      inserts.push({ table, doc });
      return 'new_id';
    }),
    patch: jest.fn(async (id: unknown, patch: Record<string, unknown>) => {
      patches.push({ id, patch });
    }),
    query: jest.fn((table: string) => ({
      withIndex: (_index: string, rangeFn?: (q: { eq: (f: string, v: unknown) => unknown }) => void) => {
        const eqs: [string, unknown][] = [];
        const q = {
          eq(field: string, value: unknown) {
            eqs.push([field, value]);
            return q;
          },
        };
        rangeFn?.(q);
        if (table === 'promo_codes') {
          const code = eqs.find(([f]) => f === 'code')?.[1] as string;
          return {
            unique: async () => (code === 'mikhail10' ? args.promo : null),
            collect: async () => [],
          };
        }
        if (table === 'promo_redemptions') {
          return { collect: async () => args.redemptions ?? [] };
        }
        if (table === 'promo_discount_claims') {
          return { collect: async () => args.claims ?? [] };
        }
        if (table === 'promo_redeem_rates') {
          return { unique: async () => args.rateRow ?? null };
        }
        return { collect: async () => [], unique: async () => null };
      },
    })),
  };
  return { db, inserts, patches };
}

describe('promo.validateDiscountCode', () => {
  const basePromo = {
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
    commissionPercent: 10, revenueCatProvisioningStatus: 'provisioned', revenueCatDiscountIdentifier: 'promo_mikhail10',
  };

  it('validates a discount code for the matching bundle and records a pending claim', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({ promo: { ...basePromo } });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
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
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({ promo: { ...basePromo } });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_30',
    });

    expect(result).toEqual({ success: false, error: 'discount_product_mismatch' });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
  });

  it('rejects an expired discount code', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({
      promo: { ...basePromo, activeTo: Date.now() - 1000 },
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'expired' });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
  });

  it('rejects a token reward code as invalid (not a discount code)', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({
      promo: { ...basePromo, rewardType: 'tokens', rewardAmount: 10 },
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('rejects when the per-user cap is already reached via a consumed claim', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const now = Date.now();
    const ctx = mockValidateCtx({
      promo: { ...basePromo, perUserLimit: 1 },
      claims: [
        {
          _id: 'claim_consumed',
          status: 'consumed',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
        },
      ],
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'per_user_cap' });
  });

  it('rejects when the per-user cap is reached via a different-product pending claim', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const now = Date.now();
    const ctx = mockValidateCtx({
      promo: { ...basePromo, perUserLimit: 1 },
      claims: [
        {
          _id: 'claim_other_product',
          status: 'pending',
          productKey: 'bundle_30',
          expiresAt: now + 1000,
        },
      ],
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'per_user_cap' });
  });

  it('refreshes an existing pending claim instead of inserting a duplicate', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const now = Date.now();
    const ctx = mockValidateCtx({
      promo: { ...basePromo, perUserLimit: 5 },
      claims: [
        {
          _id: 'claim_existing',
          status: 'pending',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
          claimedAt: now - 100,
        },
      ],
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toMatchObject({ success: true });
    // No new claim inserted; existing one patched with refreshed expiry.
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
    expect(ctx.patches.find((p) => p.id === 'claim_existing')).toBeDefined();
    expect(ctx.patches.find((p) => p.id === 'claim_existing')?.patch.expiresAt).toBeGreaterThan(now);
  });

  it('idempotently refreshes the same pending claim even when perUserLimit=1', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const now = Date.now();
    const ctx = mockValidateCtx({
      promo: { ...basePromo, perUserLimit: 1 },
      claims: [
        {
          _id: 'claim_mine',
          status: 'pending',
          productKey: 'bundle_50',
          expiresAt: now + 1000,
          claimedAt: now - 100,
        },
      ],
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    // The existing matching pending claim is excluded from the cap count, so
    // a refresh at perUserLimit=1 succeeds and updates the same claim.
    expect(result).toMatchObject({ success: true });
    expect(ctx.inserts.find((i) => i.table === 'promo_discount_claims')).toBeUndefined();
    expect(ctx.patches.find((p) => p.id === 'claim_mine')).toBeDefined();
  });

  it('rejects a discount code that is not yet provisioned in RevenueCat', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({
      promo: { ...basePromo, revenueCatProvisioningStatus: 'pending' },
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('rejects a discount code whose provisioning failed', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({
      promo: { ...basePromo, revenueCatProvisioningStatus: 'failed' },
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('rejects an unknown code', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({ promo: null });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'unknown',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'invalid_code' });
  });

  it('enforces the usage cap', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);
    const ctx = mockValidateCtx({
      promo: { ...basePromo, usageCap: 5, usedCount: 5 },
    });

    const result = await (validateDiscountCode as any)._handler(ctx as any, {
      code: 'Mikhail10',
      productKey: 'bundle_50',
    });

    expect(result).toEqual({ success: false, error: 'usage_cap' });
  });
});
