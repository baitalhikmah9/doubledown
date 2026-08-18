import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireAdmin } from './lib/auth';
import { ensureWalletDoc } from './lib/ensureWallet';
import { isAffiliateEmail, normalizeAffiliateEmail } from './lib/affiliateStats';
import { normalizePromoCode } from './lib/promoRules';
import { writeAudit } from './lib/audit';
import { scanIndexPage, SCAN_BATCH } from './lib/boundedPagination';
import {
  WALLET_TRANSACTION_SOURCES,
  WALLET_TRANSACTION_TYPES,
} from './lib/walletTransactionTypes';
import type { Doc, Id } from './_generated/dataModel';
import {
  applyPromoCodeUpdate,
  derivePromoModeDefaults,
  derivePromoCodeStatus,
  isAccountPromoMode,
  validateCreatePromoCodeArgs,
  validateWalletAdjustment,
} from './lib/adminValidation';

export const listPurchases = query({
  args: {
    status: v.optional(v.string()),
    store: v.optional(v.string()),
    purchaserQuery: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 100);
    const queryLower = args.purchaserQuery?.trim().toLowerCase();

    const fetchBatch = (upperBound: number | undefined) =>
      ctx.db
        .query('store_purchases')
        .withIndex('by_purchased_at', (range) => {
          const bound = upperBound ?? args.cursor;
          if (bound !== undefined) return range.lt('purchasedAt', bound);
          return range;
        })
        .order('desc')
        .take(SCAN_BATCH);

    const { items, nextCursor } = await scanIndexPage(
      fetchBatch,
      (purchase) => purchase.purchasedAt,
      (purchase) => {
        if (args.status !== undefined && purchase.status !== args.status) return false;
        if (args.store !== undefined && purchase.store !== args.store) return false;
        if (queryLower) {
          if (
            !purchase.purchaserAccountId.toLowerCase().includes(queryLower) &&
            !purchase.storeTransactionId.toLowerCase().includes(queryLower)
          ) {
            return false;
          }
        }
        return true;
      },
      limit
    );

    return { items, nextCursor };
  },
});

export const getPurchase = query({
  args: {
    purchaseId: v.id('store_purchases'),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      return null;
    }

    const wallet = await ctx.db
      .query('wallets')
      .withIndex('by_purchaser_account', (q) =>
        q.eq('purchaserAccountId', purchase.purchaserAccountId)
      )
      .unique();
    const transactions = await ctx.db
      .query('wallet_transactions')
      .withIndex('by_purchase_id', (q) => q.eq('purchaseId', args.purchaseId))
      .collect();

    return { purchase, wallet, transactions };
  },
});

// ───────────────────────────────────────────────
// Promo Code Queries
// ───────────────────────────────────────────────

export const listPromoCodes = query({
  args: {
    status: v.optional(v.union(
      v.literal('active'),
      v.literal('inactive'),
      v.literal('expired'),
      v.literal('scheduled'),
      v.literal('exhausted')
    )),
    mode: v.optional(v.string()),
    query: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 100);
    const now = Date.now();

    const all = await ctx.db.query('promo_codes').collect();
    const withStatus = all.map((promo) => ({
      ...promo,
      status: derivePromoCodeStatus(promo, now),
    }));

    let filtered = withStatus;

    if (args.status) {
      filtered = filtered.filter((p) => p.status === args.status);
    }

    if (args.mode) {
      filtered = filtered.filter((p) => p.mode === args.mode);
    }

    if (args.query) {
      const q = args.query.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          (p.metadata?.campaignName && String(p.metadata.campaignName).toLowerCase().includes(q))
      );
    }

    if (args.cursor) {
      filtered = filtered.filter((p) => (p.createdAt ?? 0) < args.cursor!);
    }

    filtered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const items = filtered.slice(0, limit);

    return {
      items,
      nextCursor:
        items.length === limit ? items[items.length - 1]?.createdAt ?? null : null,
    };
  },
});

export const getPromoCode = query({
  args: {
    promoCodeId: v.id('promo_codes'),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const promoCode = await ctx.db.get(args.promoCodeId);
    if (!promoCode) {
      return null;
    }

    const redemptions = await ctx.db
      .query('promo_redemptions')
      .withIndex('by_promo_code', (q) => q.eq('promoCodeId', args.promoCodeId))
      .collect();
    const restrictedUser = promoCode.restrictedToUserId
      ? await ctx.db.get(promoCode.restrictedToUserId)
      : null;

    const enriched = await Promise.all(
      redemptions.map(async (redemption) => {
        const user = redemption.userId
          ? await ctx.db.get(redemption.userId)
          : null;
        const transaction = redemption.transactionId
          ? await ctx.db.get(redemption.transactionId)
          : null;
        return {
          redemption,
          user: user
            ? {
                _id: user._id,
                email: user.email,
                name: user.name,
                clerkId: user.clerkId,
              }
            : null,
          transaction,
        };
      })
    );

    return {
      promoCode,
      restrictedUser: restrictedUser
        ? {
            _id: restrictedUser._id,
            email: restrictedUser.email,
            name: restrictedUser.name,
            clerkId: restrictedUser.clerkId,
            canonicalPurchaserAccountId: restrictedUser.canonicalPurchaserAccountId,
          }
        : null,
      redemptions: enriched,
    };
  },
});

// ───────────────────────────────────────────────
// Promo Code Mutations
// ───────────────────────────────────────────────

export const createPromoCode = mutation({
  args: {
    code: v.string(),
    rewardAmount: v.number(),
    usageCap: v.number(),
    mode: v.optional(v.union(
      v.literal('public_single_use'),
      v.literal('public_multi_use'),
      v.literal('account_single_use'),
      v.literal('account_multi_use')
    )),
    restrictedToUserId: v.optional(v.id('users')),
    restrictedToPurchaserAccountId: v.optional(v.string()),
    activeFrom: v.optional(v.number()),
    activeTo: v.optional(v.number()),
    rewardType: v.optional(v.union(v.literal('tokens'), v.literal('discount'))),
    discountPercent: v.optional(v.number()),
    productKey: v.optional(v.string()),
    affiliateEmail: v.optional(v.string()),
    commissionPercent: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        campaignName: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    const normalized = normalizePromoCode(args.code);
    const rewardType = args.rewardType ?? 'tokens';
    const affiliateEmail = args.affiliateEmail
      ? normalizeAffiliateEmail(args.affiliateEmail)
      : undefined;

    const validation = validateCreatePromoCodeArgs({
      normalizedCode: normalized,
      rewardAmount: args.rewardAmount,
      usageCap: args.usageCap,
      mode: args.mode,
      activeFrom: args.activeFrom,
      activeTo: args.activeTo,
      rewardType,
      discountPercent: args.discountPercent,
      productKey: args.productKey,
      affiliateEmail,
      commissionPercent: args.commissionPercent,
    });
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const mode = args.mode ?? 'public_multi_use';
    const modeDefaults = derivePromoModeDefaults({
      mode,
      requestedUsageCap: args.usageCap,
      restrictedToUserId: args.restrictedToUserId,
    });
    if (!modeDefaults.ok) {
      throw new Error(modeDefaults.reason);
    }

    if (isAccountPromoMode(mode)) {
      const restrictedUser = args.restrictedToUserId
        ? await ctx.db.get(args.restrictedToUserId)
        : null;
      if (!restrictedUser) {
        throw new Error('restricted_user_not_found');
      }
    }

    const existing = await ctx.db
      .query('promo_codes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();
    if (existing) {
      throw new Error('duplicate_code');
    }

    const now = Date.now();
    const promoCodeId = await ctx.db.insert('promo_codes', {
      code: normalized,
      rewardType,
      rewardAmount: args.rewardAmount,
      usageCap: modeDefaults.usageCap,
      perUserLimit: modeDefaults.perUserLimit,
      mode,
      redemptionScope: modeDefaults.redemptionScope,
      restrictedToUserId: args.restrictedToUserId,
      restrictedToPurchaserAccountId: args.restrictedToPurchaserAccountId,
      active: true,
      usedCount: 0,
      activeFrom: args.activeFrom,
      activeTo: args.activeTo,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
      createdByAdminUserId: adminUser._id,
      discountPercent: rewardType === 'discount' ? args.discountPercent : undefined,
      productKey: rewardType === 'discount' ? args.productKey : undefined,
      affiliateEmail: affiliateEmail && isAffiliateEmail(affiliateEmail) ? affiliateEmail : undefined,
      commissionPercent: affiliateEmail ? args.commissionPercent : undefined,
    });

    await writeAudit(ctx, {
      actorUserId: adminUser._id,
      actorEmail: adminUser.email,
      action: 'promo.create',
      targetType: 'promo_code',
      targetId: promoCodeId,
      after: {
        code: normalized,
        rewardType,
        rewardAmount: args.rewardAmount,
        usageCap: modeDefaults.usageCap,
        perUserLimit: modeDefaults.perUserLimit,
        mode,
        redemptionScope: modeDefaults.redemptionScope,
        restrictedToUserId: args.restrictedToUserId,
        restrictedToPurchaserAccountId: args.restrictedToPurchaserAccountId,
        active: true,
        activeFrom: args.activeFrom,
        activeTo: args.activeTo,
        discountPercent: rewardType === 'discount' ? args.discountPercent : undefined,
        productKey: rewardType === 'discount' ? args.productKey : undefined,
        affiliateEmail: affiliateEmail && isAffiliateEmail(affiliateEmail) ? affiliateEmail : undefined,
        commissionPercent: affiliateEmail ? args.commissionPercent : undefined,
      },
    });

    return { promoCodeId };
  },
});

export const updatePromoCode = mutation({
  args: {
    promoCodeId: v.id('promo_codes'),
    rewardAmount: v.optional(v.number()),
    usageCap: v.optional(v.number()),
    perUserLimit: v.optional(v.number()),
    clearPerUserLimit: v.optional(v.boolean()),
    activeFrom: v.optional(v.number()),
    activeTo: v.optional(v.number()),
    clearActiveFrom: v.optional(v.boolean()),
    clearActiveTo: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    metadata: v.optional(
      v.object({
        campaignName: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    const promo = await ctx.db.get(args.promoCodeId);
    if (!promo) {
      throw new Error('promo_code_not_found');
    }

    const result = applyPromoCodeUpdate(promo, {
      rewardAmount: args.rewardAmount,
      usageCap: args.usageCap,
      perUserLimit: args.perUserLimit,
      clearPerUserLimit: args.clearPerUserLimit,
      activeFrom: args.activeFrom,
      activeTo: args.activeTo,
      clearActiveFrom: args.clearActiveFrom,
      clearActiveTo: args.clearActiveTo,
      active: args.active,
      metadata: args.metadata,
    });
    if (!result.ok) {
      throw new Error(result.reason);
    }

    const patch: Record<string, unknown> = {
      ...result.patch,
      updatedAt: Date.now(),
      updatedByAdminUserId: adminUser._id,
    };

    const before = {
      rewardAmount: promo.rewardAmount,
      usageCap: promo.usageCap,
      perUserLimit: promo.perUserLimit,
      activeFrom: promo.activeFrom,
      activeTo: promo.activeTo,
      active: promo.active,
      metadata: promo.metadata,
    };

    await ctx.db.patch(args.promoCodeId, patch);
    await writeAudit(ctx, {
      actorUserId: adminUser._id,
      actorEmail: adminUser.email,
      action: 'promo.update',
      targetType: 'promo_code',
      targetId: args.promoCodeId,
      before,
      after: patch,
    });
    return { promoCodeId: args.promoCodeId };
  },
});

export const deactivatePromoCode = mutation({
  args: {
    promoCodeId: v.id('promo_codes'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    if (!args.reason || args.reason.trim().length === 0) {
      throw new Error('reason_required');
    }
    const promo = await ctx.db.get(args.promoCodeId);
    if (!promo) {
      throw new Error('promo_code_not_found');
    }

    const metadata = promo.metadata ?? {};
    await ctx.db.patch(args.promoCodeId, {
      active: false,
      updatedAt: Date.now(),
      metadata: { ...metadata, deactivationReason: args.reason },
    });
    await writeAudit(ctx, {
      actorUserId: adminUser._id,
      actorEmail: adminUser.email,
      action: 'promo.deactivate',
      targetType: 'promo_code',
      targetId: args.promoCodeId,
      reason: args.reason,
      before: { active: promo.active !== false },
      after: { active: false },
    });
    return { promoCodeId: args.promoCodeId };
  },
});

// ───────────────────────────────────────────────
// Wallet Queries And Mutations
// ───────────────────────────────────────────────

export const adjustWallet = mutation({
  args: {
    purchaserAccountId: v.string(),
    amount: v.number(),
    reason: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    const wallet = await ensureWalletDoc(ctx, args.purchaserAccountId);

    const validation = validateWalletAdjustment({
      currentBalance: wallet.balance,
      amount: args.amount,
      reason: args.reason,
    });
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const now = Date.now();
    const txIdempotencyKey = args.idempotencyKey
      ? `admin_adjust:${wallet._id}:${args.idempotencyKey}`
      : undefined;

    if (txIdempotencyKey) {
      const existingTx = await ctx.db
        .query('wallet_transactions')
        .withIndex('by_wallet_idempotency', (q) =>
          q.eq('walletId', wallet._id).eq('idempotencyKey', txIdempotencyKey)
        )
        .unique();
      if (existingTx) {
        return { balance: wallet.balance, transactionId: existingTx._id };
      }
    }

    const transactionId = await ctx.db.insert('wallet_transactions', {
      walletId: wallet._id,
      type: 'admin_adjustment',
      amount: args.amount,
      createdAt: now,
      status: 'posted',
      source: 'admin',
      adminActorUserId: adminUser._id,
      idempotencyKey: txIdempotencyKey,
      metadata: { reason: args.reason },
    });

    const balance = wallet.balance + args.amount;
    await ctx.db.patch(wallet._id, { balance });
    await writeAudit(ctx, {
      actorUserId: adminUser._id,
      actorEmail: adminUser.email,
      action: 'wallet.adjust',
      targetType: 'wallet',
      targetId: wallet._id,
      reason: args.reason,
      before: { balance: wallet.balance, purchaserAccountId: wallet.purchaserAccountId },
      after: { balance, transactionId },
    });
    return { balance, transactionId };
  },
});

export const getWallet = query({
  args: {
    walletId: v.id('wallets'),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const wallet = await ctx.db.get(args.walletId);
    if (!wallet) return null;

    const user = wallet.userId
      ? await ctx.db.get(wallet.userId)
      : null;
    const recentTransactions = await ctx.db
      .query('wallet_transactions')
      .withIndex('by_wallet_created', (q) => q.eq('walletId', wallet._id))
      .order('desc')
      .take(5);

    return {
      wallet,
      user: user
        ? {
            _id: user._id,
            email: user.email,
            name: user.name,
            clerkId: user.clerkId,
          }
        : null,
      recentTransactions,
    };
  },
});

export const searchWallets = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 20, 100);
    const q = args.query.trim().toLowerCase();
    if (!q) return [];

    // Search by purchaser account id directly on wallets
    const walletByPurchaser = await ctx.db
      .query('wallets')
      .withIndex('by_purchaser_account', (query) =>
        query.eq('purchaserAccountId', args.query)
      )
      .unique();

    const results = [];

    if (walletByPurchaser) {
      const user = walletByPurchaser.userId
        ? await ctx.db.get(walletByPurchaser.userId)
        : null;
      const recentTransactions = await ctx.db
        .query('wallet_transactions')
        .withIndex('by_wallet_created', (query) =>
          query.eq('walletId', walletByPurchaser._id)
        )
        .order('desc')
        .take(5);
      results.push({
        wallet: walletByPurchaser,
        user: user
          ? {
              _id: user._id,
              email: user.email,
              name: user.name,
              clerkId: user.clerkId,
            }
          : null,
        recentTransactions,
      });
    }

    // Search users by email or clerkId
    const allUsers = await ctx.db.query('users').collect();
    const matchedUsers = allUsers.filter(
      (u) =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.clerkId && u.clerkId.toLowerCase().includes(q))
    );

    for (const user of matchedUsers.slice(0, limit)) {
      const wallet = await ctx.db
        .query('wallets')
        .withIndex('by_user', (query) => query.eq('userId', user._id))
        .unique();
      if (!wallet) continue;
      // Skip if already added via purchaser account search
      if (walletByPurchaser && wallet._id === walletByPurchaser._id) continue;

      const recentTransactions = await ctx.db
        .query('wallet_transactions')
        .withIndex('by_wallet_created', (query) => query.eq('walletId', wallet._id))
        .order('desc')
        .take(5);

      results.push({
        wallet,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          clerkId: user.clerkId,
        },
        recentTransactions,
      });
    }

    return results.slice(0, limit);
  },
});

export const listWalletTransactions = query({
  args: {
    walletId: v.optional(v.id('wallets')),
    type: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 100);

    let transactions;
    if (args.walletId) {
      transactions = await ctx.db
        .query('wallet_transactions')
        .withIndex('by_wallet_created', (q) => q.eq('walletId', args.walletId!))
        .order('desc')
        .collect();
    } else {
      transactions = await ctx.db.query('wallet_transactions').order('desc').collect();
    }

    if (args.type) {
      transactions = transactions.filter((t) => t.type === args.type);
    }

    if (args.cursor) {
      transactions = transactions.filter((t) => t.createdAt < args.cursor!);
    }

    const items = transactions.slice(0, limit);
    return {
      items,
      nextCursor:
        items.length === limit ? items[items.length - 1]?.createdAt ?? null : null,
    };
  },
});

export const reversePurchaseGrant = mutation({
  args: {
    purchaseId: v.id('store_purchases'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    if (!args.reason || args.reason.trim().length === 0) {
      throw new Error('reason_required');
    }
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    const wallet = await ensureWalletDoc(ctx, purchase.purchaserAccountId);
    const purchaseTransactions = await ctx.db
      .query('wallet_transactions')
      .withIndex('by_purchase_id', (q) => q.eq('purchaseId', args.purchaseId))
      .collect();
    const originalGrant = purchaseTransactions.find((record) => record.type === 'purchase_grant');
    const existingReversal = purchaseTransactions.find(
      (record) => record.type === 'purchase_reversal'
    );

    if (!originalGrant) {
      throw new Error('Purchase grant not found');
    }

    if (existingReversal) {
      return { duplicate: true as const, balance: wallet.balance };
    }

    const reversalAmount = -Math.abs(originalGrant.amount);
    await ctx.db.insert('wallet_transactions', {
      walletId: wallet._id,
      type: 'purchase_reversal',
      amount: reversalAmount,
      createdAt: Date.now(),
      status: 'posted',
      source: 'admin',
      purchaseId: purchase._id,
      reversalOf: originalGrant._id,
      adminActorUserId: adminUser._id,
      metadata: { reason: args.reason },
    });

    // Intentionally no floor: clawbacks may drive balance negative so ledger
    // remains accurate (unlike adjustWallet, which rejects insufficient_balance).
    const balance = wallet.balance + reversalAmount;
    await ctx.db.patch(wallet._id, { balance });
    await ctx.db.patch(purchase._id, { status: 'reversed' });
    await writeAudit(ctx, {
      actorUserId: adminUser._id,
      actorEmail: adminUser.email,
      action: 'purchase.reverse',
      targetType: 'store_purchase',
      targetId: purchase._id,
      reason: args.reason,
      before: {
        purchaseStatus: purchase.status,
        balance: wallet.balance,
        storeTransactionId: purchase.storeTransactionId,
      },
      after: {
        purchaseStatus: 'reversed',
        balance,
        reversalAmount,
      },
    });
    return { duplicate: false as const, balance };
  },
});

export const upsertTokenProduct = mutation({
  args: {
    productKey: v.string(),
    tokensGranted: v.number(),
    iosProductId: v.string(),
    androidProductId: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query('token_products')
      .withIndex('by_product_key', (q) => q.eq('productKey', args.productKey))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tokensGranted: args.tokensGranted,
        iosProductId: args.iosProductId,
        androidProductId: args.androidProductId,
        isActive: args.isActive,
        sortOrder: args.sortOrder,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('token_products', {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ───────────────────────────────────────────────
// Global Transaction Ledger
// ───────────────────────────────────────────────

export const listTransactions = query({
  args: {
    query: v.optional(v.string()),
    type: v.optional(v.union(...WALLET_TRANSACTION_TYPES.map((t) => v.literal(t)))),
    source: v.optional(v.union(...WALLET_TRANSACTION_SOURCES.map((s) => v.literal(s)))),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 100);
    const q = args.query?.trim().toLowerCase();

    // Bounds are inclusive on the low side and exclusive on the high side:
    // from <= createdAt < to, with `cursor` narrowing the window for the next
    // (older) page. The screen sends the exclusive start of the day after the
    // selected To day, so every millisecond of that day is included.
    const initialUpper =
      args.cursor !== undefined
        ? args.to !== undefined
          ? Math.min(args.cursor, args.to)
          : args.cursor
        : args.to;

    const walletById = new Map<string, Doc<'wallets'>>();
    const emailByUserId = new Map<string, string>();

    const enrich = async (rows: Doc<'wallet_transactions'>[]) => {
      const freshWalletIds = [...new Set(rows.map((row) => row.walletId))].filter(
        (id) => !walletById.has(id)
      );
      const freshWallets = await Promise.all(freshWalletIds.map((id) => ctx.db.get(id)));
      freshWalletIds.forEach((id, index) => {
        const wallet = freshWallets[index];
        if (wallet) walletById.set(id, wallet);
      });
      const freshUserIds = [
        ...new Set(freshWallets.map((wallet) => wallet?.userId).filter((id): id is Id<'users'> => id !== undefined)),
      ].filter((id) => !emailByUserId.has(id));
      const freshUsers = await Promise.all(freshUserIds.map((id) => ctx.db.get(id)));
      freshUserIds.forEach((id, index) => {
        const email = freshUsers[index]?.email;
        if (email) emailByUserId.set(id, email);
      });
    };

    const fetchBatch = (upperBound: number | undefined) =>
      ctx.db
        .query('wallet_transactions')
        .withIndex('by_created', (range) => {
          const bound = upperBound ?? initialUpper;
          if (args.from !== undefined && bound !== undefined) {
            return range.gte('createdAt', args.from).lt('createdAt', bound);
          }
          if (args.from !== undefined) return range.gte('createdAt', args.from);
          if (bound !== undefined) return range.lt('createdAt', bound);
          return range;
        })
        .order('desc')
        .take(SCAN_BATCH);

    const { items, nextCursor } = await scanIndexPage(
      fetchBatch,
      (transaction) => transaction.createdAt,
      (transaction) => {
        if (args.type !== undefined && transaction.type !== args.type) return false;
        if (args.source !== undefined && transaction.source !== args.source) return false;
        if (q) {
          const wallet = walletById.get(transaction.walletId);
          const email = wallet?.userId ? emailByUserId.get(wallet.userId) : undefined;
          const haystack = [
            email?.toLowerCase(),
            wallet?.purchaserAccountId?.toLowerCase(),
            transaction._id.toLowerCase(),
            transaction.storeTransactionId?.toLowerCase(),
            transaction.idempotencyKey?.toLowerCase(),
          ]
            .filter((value): value is string => Boolean(value))
            .join(' ');
          if (!haystack.includes(q)) return false;
        }
        return true;
      },
      limit,
      q ? enrich : undefined
    );

    await enrich(items);

    const mapped = items.map((transaction) => {
      const wallet = walletById.get(transaction.walletId);
      const email = wallet?.userId ? emailByUserId.get(wallet.userId) : undefined;
      return {
        transaction,
        wallet: wallet
          ? {
              _id: wallet._id,
              purchaserAccountId: wallet.purchaserAccountId ?? null,
              userId: wallet.userId ?? null,
            }
          : null,
        userEmail: email ?? null,
      };
    });

    return { items: mapped, nextCursor };
  },
});

// ───────────────────────────────────────────────
// Admin Audit Log
// ───────────────────────────────────────────────

export const listAuditLog = query({
  args: {
    action: v.optional(v.string()),
    targetType: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 100);

    const fetchBatch = (upperBound: number | undefined) =>
      ctx.db
        .query('admin_audit_log')
        .withIndex('by_timestamp', (range) => {
          const bound = upperBound ?? args.cursor;
          if (bound !== undefined) return range.lt('timestamp', bound);
          return range;
        })
        .order('desc')
        .take(SCAN_BATCH);

    const { items, nextCursor } = await scanIndexPage(
      fetchBatch,
      (log) => log.timestamp,
      (log) => {
        if (args.action !== undefined && log.action !== args.action) return false;
        if (args.targetType !== undefined && log.targetType !== args.targetType) return false;
        return true;
      },
      limit
    );

    return { items, nextCursor };
  },
});

// ───────────────────────────────────────────────
// Admin Dashboard Stats
// ───────────────────────────────────────────────

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Start-of-month epochs for the trailing `count` months, oldest first. */
function buildMonthBuckets(
  now: number,
  count: number
): { start: number; end: number; label: string }[] {
  const buckets: { start: number; end: number; label: string }[] = [];
  const cursor = new Date(now);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const end = cursor.getTime();
    cursor.setMonth(cursor.getMonth() - 1);
    const start = cursor.getTime();
    buckets.unshift({ start, end, label: MONTH_LABELS[new Date(start).getMonth()] });
  }
  return buckets;
}

/** Percent change of `current` vs `previous`; null when there is no baseline. */
function monthDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const buckets = buildMonthBuckets(now, 12);
    const windowStart = buckets[0].start;

    // Revenue / purchase counts come from store_purchases (real money charged),
    // windowed to the trailing 12 months so the dashboard stays bounded.
    const purchases = await ctx.db
      .query('store_purchases')
      .withIndex('by_purchased_at', (q) => q.gte('purchasedAt', windowStart))
      .order('desc')
      .collect();
    const granted = purchases.filter((purchase) => purchase.status === 'granted');

    const revenueByMonth = buckets.map(() => 0);
    const purchasesByMonth = buckets.map(() => 0);
    let currencyCode: string | undefined;
    for (const purchase of granted) {
      const idx = buckets.findIndex(
        (bucket) => purchase.purchasedAt >= bucket.start && purchase.purchasedAt < bucket.end
      );
      if (idx === -1) continue;
      if (typeof purchase.priceAmountMicros === 'number') {
        revenueByMonth[idx] += purchase.priceAmountMicros;
        if (purchase.currencyCode) currencyCode = purchase.currencyCode;
      }
      purchasesByMonth[idx] += 1;
    }

    const monthlyRevenue = buckets.map((bucket, index) => ({
      label: bucket.label,
      total: revenueByMonth[index],
    }));
    const totalRevenue = revenueByMonth.reduce((sum, value) => sum + value, 0);
    const purchasesTotal = purchasesByMonth.reduce((sum, value) => sum + value, 0);
    const revenueDeltaPct = monthDeltaPct(
      revenueByMonth[revenueByMonth.length - 1],
      revenueByMonth[revenueByMonth.length - 2]
    );
    const purchasesDeltaPct = monthDeltaPct(
      purchasesByMonth[purchasesByMonth.length - 1],
      purchasesByMonth[purchasesByMonth.length - 2]
    );

    // Promo code health (small table; same full-scan pattern as listPromoCodes).
    const promoCodes = await ctx.db.query('promo_codes').collect();
    const activePromoCodes = promoCodes.filter(
      (promo) => derivePromoCodeStatus(promo, now) === 'active'
    ).length;
    const totalRedemptions = promoCodes.reduce(
      (sum, promo) => sum + (promo.usedCount ?? 0),
      0
    );

    // Latest wallet activity with account labels (mirrors listTransactions enrichment).
    const recent = await ctx.db
      .query('wallet_transactions')
      .withIndex('by_created')
      .order('desc')
      .take(6);

    const walletById = new Map<string, Doc<'wallets'>>();
    const emailByUserId = new Map<string, string>();
    const freshWalletIds = [...new Set(recent.map((transaction) => transaction.walletId))];
    const freshWallets = await Promise.all(freshWalletIds.map((id) => ctx.db.get(id)));
    freshWalletIds.forEach((id, index) => {
      const wallet = freshWallets[index];
      if (wallet) walletById.set(id, wallet);
    });
    const freshUserIds = [
      ...new Set(
        freshWallets
          .map((wallet) => wallet?.userId)
          .filter((id): id is Id<'users'> => id !== undefined)
      ),
    ];
    const freshUsers = await Promise.all(freshUserIds.map((id) => ctx.db.get(id)));
    freshUserIds.forEach((id, index) => {
      const email = freshUsers[index]?.email;
      if (email) emailByUserId.set(id, email);
    });

    const recentTransactions = recent.map((transaction) => {
      const wallet = walletById.get(transaction.walletId);
      const email = wallet?.userId ? emailByUserId.get(wallet.userId) : undefined;
      return {
        id: transaction._id,
        account: email ?? wallet?.purchaserAccountId ?? null,
        type: transaction.type,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
        walletId: transaction.walletId,
        purchaseId: transaction.purchaseId ?? null,
      };
    });

    return {
      currencyCode: currencyCode ?? 'USD',
      totalRevenue,
      revenueDeltaPct,
      purchasesTotal,
      purchasesDeltaPct,
      activePromoCodes,
      totalPromoCodes: promoCodes.length,
      totalRedemptions,
      monthlyRevenue,
      recentTransactions,
    };
  },
});
