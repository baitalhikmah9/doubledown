import { describe, expect, it } from '@jest/globals';
import {
  createPromoCode,
  deactivatePromoCode,
  reversePurchaseGrant,
  updatePromoCode,
} from '@/convex/admin';
import { getConvexHandler } from '../helpers/convexHandler';
import {
  createConvexTestCtx,
  userDoc,
  type ConvexDoc,
} from '../helpers/convexTestCtx';

type AnyArgs = Record<string, string | number | boolean | undefined | { campaignName?: string; notes?: string }>;

const reverseHandler = getConvexHandler<ReturnType<typeof createConvexTestCtx>, AnyArgs, unknown>(
  reversePurchaseGrant
);
const deactivateHandler = getConvexHandler<
  ReturnType<typeof createConvexTestCtx>,
  AnyArgs,
  unknown
>(deactivatePromoCode);
const updateHandler = getConvexHandler<ReturnType<typeof createConvexTestCtx>, AnyArgs, unknown>(
  updatePromoCode
);
const createHandler = getConvexHandler<ReturnType<typeof createConvexTestCtx>, AnyArgs, unknown>(
  createPromoCode
);

function adminCtx(tables: Record<string, ConvexDoc[]> = {}) {
  const admin = userDoc({
    id: 'users_admin',
    clerkId: 'clerk_admin',
    email: 'admin@example.com',
    role: 'admin',
  });
  return createConvexTestCtx({
    identity: { subject: 'clerk_admin', email: 'admin@example.com' },
    tables: {
      users: [admin],
      ...tables,
    },
  });
}

describe('reversePurchaseGrant reason validation', () => {
  it('rejects empty and whitespace-only reasons before any read or write', async () => {
    const ctx = adminCtx();
    await expect(
      reverseHandler(ctx, {
        // SAFETY: Test fixture id branded as Convex Id<'store_purchases'>.
        purchaseId: 'store_purchases_1' as never,
        reason: '   ',
      })
    ).rejects.toThrow('reason_required');
    expect(ctx.db.get).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it('rejects an empty string reason', async () => {
    const ctx = adminCtx();
    await expect(
      reverseHandler(ctx, {
        // SAFETY: Test fixture id branded as Convex Id<'store_purchases'>.
        purchaseId: 'store_purchases_1' as never,
        reason: '',
      })
    ).rejects.toThrow('reason_required');
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe('deactivatePromoCode reason validation', () => {
  it('rejects empty reasons before any read or write', async () => {
    const ctx = adminCtx();
    await expect(
      deactivateHandler(ctx, {
        // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
        promoCodeId: 'promo_codes_1' as never,
        reason: '  ',
      })
    ).rejects.toThrow('reason_required');
    expect(ctx.db.get).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('preserves existing metadata when recording the deactivation reason', async () => {
    const promo: ConvexDoc = {
      _id: 'promo_codes_1',
      active: true,
      metadata: { campaignName: 'Spring 2025', notes: 'internal' },
    };
    const ctx = adminCtx({ promo_codes: [promo] });
    await deactivateHandler(ctx, {
      // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
      promoCodeId: 'promo_codes_1' as never,
      reason: 'abuse',
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'promo_codes_1',
      expect.objectContaining({
        active: false,
        metadata: {
          campaignName: 'Spring 2025',
          notes: 'internal',
          deactivationReason: 'abuse',
        },
      })
    );
  });
});

describe('updatePromoCode clear contract and metadata preservation', () => {
  const promo: ConvexDoc = {
    _id: 'promo_codes_1',
    rewardAmount: 100,
    usageCap: 50,
    perUserLimit: 5,
    activeFrom: 1_000,
    activeTo: 2_000,
    active: true,
    usedCount: 0,
    metadata: { campaignName: 'Camp', deactivationReason: 'abuse' },
  };

  // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
  it('passes clearActiveFrom through to the patch as undefined (field removal)', async () => {
    const ctx = adminCtx({ promo_codes: [{ ...promo }] });
    await updateHandler(ctx, {
      // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
      promoCodeId: 'promo_codes_1' as never,
      clearActiveFrom: true,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'promo_codes_1',
      expect.objectContaining({ activeFrom: undefined })
    );
  });

  it('merges edited metadata instead of replacing it', async () => {
    const ctx = adminCtx({ promo_codes: [{ ...promo }] });
    await updateHandler(ctx, {
      // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
      promoCodeId: 'promo_codes_1' as never,
      metadata: { campaignName: 'Renamed' },
    });
    const patchCall = ctx.db.patch.mock.calls[0];
    // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
    const patch = patchCall?.[1] as { metadata?: Record<string, string> };
    expect(patch.metadata).toEqual({
      campaignName: 'Renamed',
      deactivationReason: 'abuse',
    });
  });

  it('rejects zero perUserLimit at the mutation boundary', async () => {
    const ctx = adminCtx({ promo_codes: [{ ...promo }] });
    await expect(
      updateHandler(ctx, {
        // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
        promoCodeId: 'promo_codes_1' as never,
        perUserLimit: 0,
      })
    ).rejects.toThrow('per_user_limit_invalid');
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('rejects a schedule where activeFrom is not before activeTo', async () => {
    const ctx = adminCtx({ promo_codes: [{ ...promo }] });
    await expect(
      updateHandler(ctx, {
        // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
        promoCodeId: 'promo_codes_1' as never,
        activeFrom: 3_000,
        activeTo: 2_000,
      })
    ).rejects.toThrow('active_from_before_active_to');
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('allows clearing both schedule fields without an ordering conflict', async () => {
    const ctx = adminCtx({ promo_codes: [{ ...promo }] });
    await updateHandler(ctx, {
      // SAFETY: Test fixture id branded as Convex Id<'promo_codes'>.
      promoCodeId: 'promo_codes_1' as never,
      clearActiveFrom: true,
      clearActiveTo: true,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'promo_codes_1',
      expect.objectContaining({ activeFrom: undefined, activeTo: undefined })
    );
  });
});

describe('createPromoCode affiliate and discount', () => {
  it('stores an affiliate discount code with unlimited uses and no expiry', async () => {
    const ctx = adminCtx();
    await createHandler(ctx, {
      code: 'Mikhail10',
      rewardAmount: 0,
      usageCap: 0,
      mode: 'public_multi_use',
      rewardType: 'discount',
      discountPercent: 10,
      productKey: 'web_bundle_100',
      affiliateEmail: '  Creator@Example.com ',
      commissionPercent: 10,
    });
    expect(ctx.db.insert).toHaveBeenCalledWith(
      'promo_codes',
      expect.objectContaining({
        code: 'mikhail10',
        rewardType: 'discount',
        rewardAmount: 0,
        usageCap: 0,
        discountPercent: 10,
        productKey: 'web_bundle_100',
        affiliateEmail: 'creator@example.com',
        commissionPercent: 10,
        activeTo: undefined,
      })
    );
  });

  it('rejects a discount that is not scoped to a known bundle', async () => {
    const ctx = adminCtx();
    await expect(
      createHandler(ctx, {
        code: 'badbundle',
        rewardAmount: 0,
        usageCap: 0,
        mode: 'public_multi_use',
        rewardType: 'discount',
        discountPercent: 20,
        productKey: 'web_bundle_5',
      })
    ).rejects.toThrow('product_key_invalid');
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});
