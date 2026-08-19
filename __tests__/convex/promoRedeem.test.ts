import { describe, expect, it, jest } from '@jest/globals';
import { redeemCode } from '@/convex/promo';
import { requireUser } from '@/convex/lib/auth';
import { ensureWalletDoc } from '@/convex/lib/ensureWallet';

jest.mock('@/convex/lib/auth', () => ({
  requireUser: jest.fn(),
}));

jest.mock('@/convex/lib/purchaserAccounts', () => ({
  ensureCanonicalPurchaserAccountForUser: jest.fn(async () => ({
    appUserId: 'purchaser_1',
  })),
}));

jest.mock('@/convex/lib/ensureWallet', () => ({
  ensureWalletDoc: jest.fn(async () => ({ _id: 'wallet_1', balance: 0 })),
}));

function mockRedeemCtx(promo: Record<string, unknown> | null) {
  const db = {
    get: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    insert: jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => 'new_id'),
    patch: jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => {}),
    query: jest.fn((table: string) => ({
      withIndex: () => ({
        unique: async () => (table === 'promo_codes' ? promo : null),
        collect: async () => [],
      }),
    })),
  };
  return { db, auth: { getUserIdentity: jest.fn() } };
}

describe('promo.redeemCode discount block', () => {
  it('refuses a stored discount code without writing wallet or usage records', async () => {
    (requireUser as jest.MockedFunction<typeof requireUser>).mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);

    const ctx = mockRedeemCtx({
      _id: 'promo_discount',
      code: 'mikhail10',
      rewardType: 'discount',
      rewardAmount: 0,
      usageCap: 0,
      usedCount: 0,
      perUserLimit: 1,
      active: true,
    });

    await expect((redeemCode as any)._handler(ctx as any, { code: 'Mikhail10' })).resolves.toEqual({
      success: false,
      error: 'discount_checkout_unavailable',
    });

    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ensureWalletDoc).not.toHaveBeenCalled();
  });

  it('still grants tokens for a valid token reward code', async () => {
    (requireUser as jest.MockedFunction<typeof requireUser>).mockResolvedValueOnce({
      _id: 'users_1',
      email: 'fan@example.com',
    } as never);

    const ctx = mockRedeemCtx({
      _id: 'promo_tokens',
      code: 'free10',
      rewardType: 'tokens',
      rewardAmount: 10,
      usageCap: 100,
      usedCount: 0,
      perUserLimit: 1,
      active: true,
    });

    const result = await (redeemCode as any)._handler(ctx as any, {
      code: 'FREE10',
      clientRequestId: 'req_1',
    });
    expect(result).toMatchObject({ success: true, tokensGranted: 10 });
  });
});
