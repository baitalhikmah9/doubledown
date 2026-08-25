import { describe, expect, it } from '@jest/globals';
import { redeemCode } from '@/convex/promo';
import { getConvexHandler } from '../helpers/convexHandler';
import {
  createConvexTestCtx,
  purchaserAccountDoc,
  userDoc,
  walletDoc,
  type ConvexDoc,
} from '../helpers/convexTestCtx';

type RedeemArgs = { code: string; clientRequestId?: string };
type RedeemResult = {
  success: boolean;
  error?: string;
  tokensGranted?: number;
};

const handler = getConvexHandler<
  ReturnType<typeof createConvexTestCtx>,
  RedeemArgs,
  RedeemResult
>(redeemCode);

function redeemCtx(promo: ConvexDoc | null) {
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
  const wallet = walletDoc({
    id: 'wallet_1',
    purchaserAccountId: 'purchaser_1',
    userId: 'users_1',
    balance: 0,
  });
  return createConvexTestCtx({
    identity: { subject: 'clerk_fan', email: 'fan@example.com' },
    tables: {
      users: [user],
      purchaser_accounts: [purchaser],
      wallets: [wallet],
      promo_codes: promo ? [promo] : [],
      promo_redemptions: [],
      promo_redeem_rates: [],
    },
  });
}

describe('promo.redeemCode discount block', () => {
  it('refuses a stored discount code without writing wallet or usage records', async () => {
    const ctx = redeemCtx({
      _id: 'promo_discount',
      code: 'mikhail10',
      rewardType: 'discount',
      rewardAmount: 0,
      usageCap: 0,
      usedCount: 0,
      perUserLimit: 1,
      active: true,
    });

    await expect(handler(ctx, { code: 'Mikhail10' })).resolves.toEqual({
      success: false,
      error: 'discount_checkout_unavailable',
    });

    expect(ctx.inserts.filter((i) => i.table !== 'promo_redeem_rates')).toEqual([]);
  });

  it('still grants tokens for a valid token reward code', async () => {
    const ctx = redeemCtx({
      _id: 'promo_tokens',
      code: 'free10',
      rewardType: 'tokens',
      rewardAmount: 10,
      usageCap: 100,
      usedCount: 0,
      perUserLimit: 1,
      active: true,
    });

    const result = await handler(ctx, {
      code: 'FREE10',
      clientRequestId: 'req_1',
    });
    expect(result).toMatchObject({ success: true, tokensGranted: 10 });
  });
});
