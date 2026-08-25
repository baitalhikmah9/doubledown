import { describe, expect, it } from '@jest/globals';
import {
  aggregateAffiliateEarnings,
  computeCommissionMicros,
  isAffiliateEmail,
  normalizeAffiliateEmail,
} from '@/convex/lib/affiliateStats';
import { getMyDashboard } from '@/convex/affiliate';
import { getConvexHandler } from '../helpers/convexHandler';
import {
  createConvexTestCtx,
  userDoc,
  type ConvexDoc,
} from '../helpers/convexTestCtx';

describe('affiliateStats', () => {
  it('normalizes affiliate emails', () => {
    expect(normalizeAffiliateEmail('  Creator@Example.com ')).toBe('creator@example.com');
    expect(isAffiliateEmail('creator@example.com')).toBe(true);
    expect(isAffiliateEmail('not-an-email')).toBe(false);
  });

  it('computes commission from the post-discount sale using integer micros', () => {
    expect(computeCommissionMicros(8_000_000, 10)).toBe(800_000);
    expect(computeCommissionMicros(199, 10)).toBe(19);
  });

  it('groups earnings by currency and does not mix them', () => {
    const stats = aggregateAffiliateEarnings(
      [
        { priceAmountMicros: 8_000_000, currencyCode: 'GBP', commissionAmountMicros: 800_000 },
        { priceAmountMicros: 12_000_000, currencyCode: 'GBP', commissionAmountMicros: 1_200_000 },
        { priceAmountMicros: 10_000_000, currencyCode: 'USD', commissionAmountMicros: 1_000_000 },
      ],
      10
    );

    expect(stats).toEqual([
      {
        currencyCode: 'GBP',
        purchaseCount: 2,
        totalSaleMicros: 20_000_000,
        totalCommissionMicros: 2_000_000,
        averageSaleMicros: 10_000_000,
        averageCommissionMicros: 1_000_000,
      },
      {
        currencyCode: 'USD',
        purchaseCount: 1,
        totalSaleMicros: 10_000_000,
        totalCommissionMicros: 1_000_000,
        averageSaleMicros: 10_000_000,
        averageCommissionMicros: 1_000_000,
      },
    ]);
  });

  it('skips purchases missing currency or price instead of inventing a total', () => {
    expect(
      aggregateAffiliateEarnings(
        [
          { priceAmountMicros: 8_000_000 },
          { currencyCode: 'GBP' },
          { priceAmountMicros: 5_000_000, currencyCode: 'GBP' },
        ],
        10
      )
    ).toEqual([
      {
        currencyCode: 'GBP',
        purchaseCount: 1,
        totalSaleMicros: 5_000_000,
        totalCommissionMicros: 500_000,
        averageSaleMicros: 5_000_000,
        averageCommissionMicros: 500_000,
      },
    ]);
  });
});

const handler = getConvexHandler<ReturnType<typeof createConvexTestCtx>, Record<string, never>, {
  codes: Record<string, string | number | boolean | null | Record<string, string | number>[]>[];
}>(getMyDashboard);

function affiliateCtx(results: {
  promos?: ConvexDoc[];
  purchases?: ConvexDoc[];
  identity?: { subject: string; email?: string } | null;
}) {
  const user = userDoc({
    id: 'users_creator',
    clerkId: 'clerk_creator',
    email: '  Creator@Example.com ',
  });
  return createConvexTestCtx({
    identity:
      results.identity === null
        ? null
        : (results.identity ?? { subject: 'clerk_creator', email: 'creator@example.com' }),
    tables: {
      users: [user],
      promo_codes: results.promos ?? [],
      store_purchases: results.purchases ?? [],
    },
  });
}

describe('affiliate.getMyDashboard', () => {
  it('rejects unauthenticated access before any read', async () => {
    const ctx = affiliateCtx({ identity: null });
    await expect(handler(ctx, {})).rejects.toThrow('Not authenticated');
  });

  it('scopes codes to the normalized email and loads purchases only by that promo id', async () => {
    const ctx = affiliateCtx({
      promos: [
        {
          _id: 'promo_mine',
          code: 'mikhail10',
          usedCount: 4,
          rewardType: 'discount',
          discountPercent: 10,
          productKey: 'bundle_50',
          commissionPercent: 10,
          affiliateEmail: 'creator@example.com',
        },
      ],
      purchases: [
        {
          _id: 'purchase_1',
          status: 'granted',
          priceAmountMicros: 8_000_000,
          currencyCode: 'GBP',
          commissionAmountMicros: 800_000,
          promoCodeId: 'promo_mine',
        },
      ],
    });

    const result = await handler(ctx, {});

    expect(result.codes).toEqual([
      {
        code: 'mikhail10',
        usageCount: 4,
        rewardType: 'discount',
        discountPercent: 10,
        productKey: 'bundle_50',
        commissionPercent: 10,
        activeTo: null,
        earningsByCurrency: [
          {
            currencyCode: 'GBP',
            purchaseCount: 1,
            totalSaleMicros: 8_000_000,
            totalCommissionMicros: 800_000,
            averageSaleMicros: 8_000_000,
            averageCommissionMicros: 800_000,
          },
        ],
        totalSaleMicros: 8_000_000,
        totalCommissionMicros: 800_000,
      },
    ]);
  });
});
