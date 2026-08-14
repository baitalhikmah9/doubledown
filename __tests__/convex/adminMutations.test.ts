import { describe, expect, it, jest } from '@jest/globals';
import {
  deactivatePromoCode,
  reversePurchaseGrant,
  updatePromoCode,
} from '@/convex/admin';

jest.mock('@/convex/lib/auth', () => ({
  requireAdmin: jest.fn(async () => ({
    _id: 'users_admin',
    email: 'admin@example.com',
    role: 'admin',
  })),
}));

function mockCtx() {
  const db = {
    get: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    insert: jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => 'new_id'),
    patch: jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => {}),
    query: jest.fn(() => ({
      withIndex: () => ({
        unique: async () => null,
        collect: async () => [],
        order: () => ({ take: async () => [], collect: async () => [] }),
      }),
      collect: async () => [],
    })),
  };
  return { db, auth: { getUserIdentity: jest.fn() } };
}

describe('reversePurchaseGrant reason validation', () => {
  it('rejects empty and whitespace-only reasons before any read or write', async () => {
    const ctx = mockCtx();
    await expect(
      (reversePurchaseGrant as any)._handler(ctx as any, {
        purchaseId: 'store_purchases_1' as any,
        reason: '   ',
      })
    ).rejects.toThrow('reason_required');
    expect(ctx.db.get).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it('rejects an empty string reason', async () => {
    const ctx = mockCtx();
    await expect(
      (reversePurchaseGrant as any)._handler(ctx as any, {
        purchaseId: 'store_purchases_1' as any,
        reason: '',
      })
    ).rejects.toThrow('reason_required');
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe('deactivatePromoCode reason validation', () => {
  it('rejects empty reasons before any read or write', async () => {
    const ctx = mockCtx();
    await expect(
      (deactivatePromoCode as any)._handler(ctx as any, {
        promoCodeId: 'promo_codes_1' as any,
        reason: '  ',
      })
    ).rejects.toThrow('reason_required');
    expect(ctx.db.get).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('preserves existing metadata when recording the deactivation reason', async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({
      _id: 'promo_codes_1',
      active: true,
      metadata: { campaignName: 'Spring 2025', notes: 'internal' },
    });
    await (deactivatePromoCode as any)._handler(ctx as any, {
      promoCodeId: 'promo_codes_1' as any,
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
  const promo = {
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

  it('passes clearActiveFrom through to the patch as undefined (field removal)', async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ ...promo });
    await (updatePromoCode as any)._handler(ctx as any, {
      promoCodeId: 'promo_codes_1' as any,
      clearActiveFrom: true,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'promo_codes_1',
      expect.objectContaining({ activeFrom: undefined })
    );
  });

  it('merges edited metadata instead of replacing it', async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ ...promo });
    await (updatePromoCode as any)._handler(ctx as any, {
      promoCodeId: 'promo_codes_1' as any,
      metadata: { campaignName: 'Renamed' },
    });
    const patch = (ctx.db.patch as any).mock.calls[0][1] as Record<string, unknown>;
    expect(patch.metadata).toEqual({
      campaignName: 'Renamed',
      deactivationReason: 'abuse',
    });
  });

  it('rejects zero perUserLimit at the mutation boundary', async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ ...promo });
    await expect(
      (updatePromoCode as any)._handler(ctx as any, {
        promoCodeId: 'promo_codes_1' as any,
        perUserLimit: 0,
      })
    ).rejects.toThrow('per_user_limit_invalid');
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('rejects a schedule where activeFrom is not before activeTo', async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ ...promo });
    await expect(
      (updatePromoCode as any)._handler(ctx as any, {
        promoCodeId: 'promo_codes_1' as any,
        activeFrom: 3_000,
        activeTo: 2_000,
      })
    ).rejects.toThrow('active_from_before_active_to');
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('allows clearing both schedule fields without an ordering conflict', async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ ...promo });
    await (updatePromoCode as any)._handler(ctx as any, {
      promoCodeId: 'promo_codes_1' as any,
      clearActiveFrom: true,
      clearActiveTo: true,
    });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'promo_codes_1',
      expect.objectContaining({ activeFrom: undefined, activeTo: undefined })
    );
  });
});
