import { query } from './_generated/server';
import { aggregateAffiliateEarnings, normalizeAffiliateEmail } from './lib/affiliateStats';
import { requireUser } from './lib/auth';

export const getMyDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.email) {
      return { codes: [] };
    }

    const affiliateEmail = normalizeAffiliateEmail(user.email);
    const assigned = await ctx.db
      .query('promo_codes')
      .withIndex('by_affiliate_email', (q) => q.eq('affiliateEmail', affiliateEmail))
      .collect();

    const codes = await Promise.all(
      assigned.map(async (promo) => {
        const purchases = await ctx.db
          .query('store_purchases')
          .withIndex('by_promo_code', (q) => q.eq('promoCodeId', promo._id))
          .collect();
        const attributed = purchases.filter((purchase) => purchase.status === 'granted');
        const commissionPercent = promo.commissionPercent ?? 0;

        return {
          code: promo.code,
          usageCount: promo.usedCount ?? 0,
          rewardType: promo.rewardType,
          discountPercent: promo.discountPercent ?? null,
          productKey: promo.productKey ?? null,
          commissionPercent,
          checkoutDiscountBlocked: promo.rewardType === 'discount',
          earningsByCurrency: aggregateAffiliateEarnings(attributed, commissionPercent),
        };
      })
    );

    return { codes };
  },
});
