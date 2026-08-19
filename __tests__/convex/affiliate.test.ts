import { describe, expect, it, jest } from '@jest/globals';
import {
  aggregateAffiliateEarnings,
  computeCommissionMicros,
  isAffiliateEmail,
  normalizeAffiliateEmail,
} from '@/convex/lib/affiliateStats';
import { getMyDashboard } from '@/convex/affiliate';
import { requireUser } from '@/convex/lib/auth';

jest.mock('@/convex/lib/auth', () => ({
  requireUser: jest.fn(),
}));

describe('affiliateStats', () => {
  it('normalizes affiliate emails', () => {
    expect(normalizeAffiliateEmail('  Creator@Example.com ')).toBe('creator@example.com');
    expect(isAffiliateEmail('creator@example.com')).toBe(true);
    expect(isAffiliateEmail('not-an-email')).toBe(false);
  });

  it('computes commission from the post-discount sale using integer micros', () => {
    // £8.00 at 10% = £0.80
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

const mockedRequireUser = requireUser as jest.MockedFunction<typeof requireUser>;

function mockAffiliateCtx(results: Record<string, unknown[]>) {
  const calls: { table: string; index: string; eqs: [string, unknown][] }[] = [];
  const db = {
    query: jest.fn((table: string) => ({
      withIndex: (
        index: string,
        rangeFn?: (q: { eq: (field: string, value: unknown) => unknown }) => void
      ) => {
        const eqs: [string, unknown][] = [];
        const q = {
          eq(field: string, value: unknown) {
            eqs.push([field, value]);
            return q;
          },
        };
        rangeFn?.(q);
        calls.push({ table, index, eqs });
        return {
          collect: async () => results[`${table}:${index}`] ?? [],
        };
      },
    })),
  };
  return { db, auth: { getUserIdentity: jest.fn() }, calls };
}

describe('affiliate.getMyDashboard', () => {
  it('rejects unauthenticated access before any read', async () => {
    mockedRequireUser.mockRejectedValueOnce(new Error('Not authenticated'));
    const ctx = mockAffiliateCtx({});
    await expect((getMyDashboard as any)._handler(ctx as any, {})).rejects.toThrow(
      'Not authenticated'
    );
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it('scopes codes to the normalized email and loads purchases only by that promo id', async () => {
    mockedRequireUser.mockResolvedValueOnce({
      _id: 'users_creator',
      email: '  Creator@Example.com ',
    } as never);
    const ctx = mockAffiliateCtx({
      'promo_codes:by_affiliate_email': [
        {
          _id: 'promo_mine',
          code: 'mikhail10',
          usedCount: 4,
          rewardType: 'discount',
          discountPercent: 10,
          productKey: 'bundle_50',
          commissionPercent: 10,
        },
      ],
      'store_purchases:by_promo_code': [
        {
          status: 'granted',
          priceAmountMicros: 8_000_000,
          currencyCode: 'GBP',
          commissionAmountMicros: 800_000,
        },
      ],
    });

    const result = await (getMyDashboard as any)._handler(ctx as any, {});

    expect(ctx.calls).toEqual([
      {
        table: 'promo_codes',
        index: 'by_affiliate_email',
        eqs: [['affiliateEmail', 'creator@example.com']],
      },
      {
        table: 'store_purchases',
        index: 'by_promo_code',
        eqs: [['promoCodeId', 'promo_mine']],
      },
    ]);
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
