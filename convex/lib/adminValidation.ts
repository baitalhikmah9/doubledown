import { isAffiliateEmail, normalizeAffiliateEmail } from './affiliateStats';
import { DEFAULT_TOKEN_PRODUCTS } from './paymentCatalog';
import { isUnlimitedUsageCap } from './promoRules';

/**
 * Pure validation helpers for admin operations.
 */

export const PROMO_CODE_MODES = [
  'public_single_use',
  'public_multi_use',
  'account_single_use',
  'account_multi_use',
] as const;

export type PromoCodeMode = (typeof PROMO_CODE_MODES)[number];

export type PromoRedemptionScope = 'public' | 'account';

export function isPromoCodeMode(value: string): value is PromoCodeMode {
  return PROMO_CODE_MODES.includes(value as PromoCodeMode);
}

export function isAccountPromoMode(mode: PromoCodeMode): boolean {
  return mode === 'account_single_use' || mode === 'account_multi_use';
}

export function isMultiUsePromoMode(mode: PromoCodeMode): boolean {
  return mode === 'public_multi_use' || mode === 'account_multi_use';
}

export function derivePromoModeDefaults(args: {
  mode: string;
  requestedUsageCap?: number;
  restrictedToUserId?: string;
}):
  | {
      ok: true;
      usageCap: number;
      perUserLimit: number;
      redemptionScope: PromoRedemptionScope;
    }
  | { ok: false; reason: string } {
  if (!isPromoCodeMode(args.mode)) {
    return { ok: false, reason: 'mode_invalid' };
  }

  const isAccountMode = isAccountPromoMode(args.mode);
  if (isAccountMode && !args.restrictedToUserId) {
    return { ok: false, reason: 'restricted_user_required' };
  }
  if (!isAccountMode && args.restrictedToUserId) {
    return { ok: false, reason: 'restricted_user_not_allowed' };
  }

  if (isMultiUsePromoMode(args.mode)) {
    if (
      args.requestedUsageCap === undefined ||
      !Number.isInteger(args.requestedUsageCap) ||
      args.requestedUsageCap < 0
    ) {
      return { ok: false, reason: 'usage_cap_positive' };
    }

    return {
      ok: true,
      usageCap: args.requestedUsageCap,
      perUserLimit: args.mode === 'account_multi_use' ? args.requestedUsageCap : 1,
      redemptionScope: isAccountMode ? 'account' : 'public',
    };
  }

  return {
    ok: true,
    usageCap: 1,
    perUserLimit: 1,
    redemptionScope: isAccountMode ? 'account' : 'public',
  };
}

export function derivePromoCodeStatus(
  promo: {
    active?: boolean;
    activeFrom?: number;
    activeTo?: number;
    usedCount?: number;
    usageCap: number;
  },
  now = Date.now()
): 'active' | 'inactive' | 'expired' | 'scheduled' | 'exhausted' {
  if (promo.active === false) return 'inactive';
  if (promo.activeFrom !== undefined && now < promo.activeFrom) return 'scheduled';
  if (promo.activeTo !== undefined && now > promo.activeTo) return 'expired';
  if (!isUnlimitedUsageCap(promo.usageCap) && (promo.usedCount ?? 0) >= promo.usageCap) {
    return 'exhausted';
  }
  return 'active';
}

const TOKEN_PRODUCT_KEYS = new Set(DEFAULT_TOKEN_PRODUCTS.map((product) => product.productKey));

export function isKnownTokenProductKey(productKey: string): boolean {
  return TOKEN_PRODUCT_KEYS.has(productKey);
}

function validatePercent(value: number | undefined, reason: string) {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    return { ok: false as const, reason };
  }
  return { ok: true as const };
}

export function validateCreatePromoCodeArgs(args: {
  normalizedCode: string;
  rewardAmount: number;
  usageCap: number;
  mode?: string;
  activeFrom?: number;
  activeTo?: number;
  rewardType?: string;
  discountPercent?: number;
  productKey?: string;
  affiliateEmail?: string;
  commissionPercent?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!args.normalizedCode) return { ok: false, reason: 'code_required' };
  const rewardType = args.rewardType ?? 'tokens';
  if (rewardType !== 'tokens' && rewardType !== 'discount') {
    return { ok: false, reason: 'reward_type_invalid' };
  }
  if (rewardType === 'discount') {
    const percent = validatePercent(args.discountPercent, 'discount_percent_invalid');
    if (!percent.ok) return percent;
    if (!args.productKey || !isKnownTokenProductKey(args.productKey)) {
      return { ok: false, reason: 'product_key_invalid' };
    }
    if (args.rewardAmount !== 0) {
      return { ok: false, reason: 'discount_reward_amount_zero' };
    }
  } else {
    if (args.rewardAmount <= 0) return { ok: false, reason: 'reward_amount_positive' };
    if (!Number.isInteger(args.rewardAmount)) {
      return { ok: false, reason: 'reward_amount_integer' };
    }
    if (!Number.isFinite(args.rewardAmount) || args.rewardAmount > 1_000_000_000) {
      return { ok: false, reason: 'reward_amount_invalid' };
    }
  }
  if (args.usageCap < 0) return { ok: false, reason: 'usage_cap_nonnegative' };
  if (!Number.isInteger(args.usageCap)) return { ok: false, reason: 'usage_cap_integer' };
  if (!Number.isFinite(args.usageCap) || args.usageCap > 1_000_000_000) {
    return { ok: false, reason: 'usage_cap_invalid' };
  }
  if (args.mode !== undefined && !isPromoCodeMode(args.mode)) {
    return { ok: false, reason: 'mode_invalid' };
  }
  if (
    args.activeFrom !== undefined &&
    args.activeTo !== undefined &&
    args.activeFrom >= args.activeTo
  ) {
    return { ok: false, reason: 'active_from_before_active_to' };
  }
  const affiliateEmail = args.affiliateEmail
    ? normalizeAffiliateEmail(args.affiliateEmail)
    : '';
  if (affiliateEmail) {
    if (!isAffiliateEmail(affiliateEmail)) {
      return { ok: false, reason: 'affiliate_email_invalid' };
    }
    const commission = validatePercent(args.commissionPercent, 'commission_percent_invalid');
    if (!commission.ok) return commission;
  } else if (args.commissionPercent !== undefined) {
    return { ok: false, reason: 'affiliate_email_required' };
  }
  return { ok: true };
}

/**
 * Build the patch for `updatePromoCode` from validated updates.
 *
 * Schedule fields are cleared with explicit `clear*` booleans instead of
 * `undefined`, because Convex drops undefined optional args over the wire.
 * `activeFrom`/`activeTo` must be clearable to `undefined` via `db.patch`,
 * which removes a field when it is set to `undefined`.
 */
export function applyPromoCodeUpdate(
  promo: {
    rewardAmount: number;
    usageCap: number;
    perUserLimit?: number;
    activeFrom?: number;
    activeTo?: number;
    usedCount?: number;
    metadata?: unknown;
  },
  updates: {
    rewardAmount?: number;
    usageCap?: number;
    perUserLimit?: number;
    clearPerUserLimit?: boolean;
    activeFrom?: number;
    activeTo?: number;
    clearActiveFrom?: boolean;
    clearActiveTo?: boolean;
    active?: boolean;
    metadata?: { campaignName?: string; notes?: string };
  }
): { ok: true; patch: Record<string, unknown> } | { ok: false; reason: string } {
  const baseValidation = validateUpdatePromoCodeArgs(promo, {
    rewardAmount: updates.rewardAmount,
    usageCap: updates.usageCap,
  });
  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (updates.perUserLimit !== undefined && !updates.clearPerUserLimit) {
    if (
      !Number.isFinite(updates.perUserLimit) ||
      !Number.isInteger(updates.perUserLimit) ||
      updates.perUserLimit <= 0
    ) {
      return { ok: false, reason: 'per_user_limit_invalid' };
    }
  }

  const effectivePerUserLimit = updates.clearPerUserLimit
    ? undefined
    : (updates.perUserLimit ?? promo.perUserLimit);
  if (effectivePerUserLimit !== undefined) {
    const effectiveUsageCap = updates.usageCap ?? promo.usageCap;
    if (
      effectiveUsageCap === undefined ||
      !Number.isFinite(effectiveUsageCap) ||
      (!isUnlimitedUsageCap(effectiveUsageCap) && effectivePerUserLimit > effectiveUsageCap)
    ) {
      return { ok: false, reason: 'per_user_limit_exceeds_cap' };
    }
  }

  const effectiveActiveFrom = updates.clearActiveFrom
    ? undefined
    : (updates.activeFrom ?? promo.activeFrom);
  const effectiveActiveTo = updates.clearActiveTo
    ? undefined
    : (updates.activeTo ?? promo.activeTo);
  if (
    effectiveActiveFrom !== undefined &&
    effectiveActiveTo !== undefined &&
    effectiveActiveFrom >= effectiveActiveTo
  ) {
    return { ok: false, reason: 'active_from_before_active_to' };
  }

  const patch: Record<string, unknown> = {};
  if (updates.rewardAmount !== undefined) patch.rewardAmount = updates.rewardAmount;
  if (updates.usageCap !== undefined) patch.usageCap = updates.usageCap;
  if (updates.perUserLimit !== undefined) patch.perUserLimit = updates.perUserLimit;
  if (updates.clearPerUserLimit) patch.perUserLimit = undefined;
  if (updates.activeFrom !== undefined) patch.activeFrom = updates.activeFrom;
  if (updates.clearActiveFrom) patch.activeFrom = undefined;
  if (updates.activeTo !== undefined) patch.activeTo = updates.activeTo;
  if (updates.clearActiveTo) patch.activeTo = undefined;
  if (updates.active !== undefined) patch.active = updates.active;
  if (updates.metadata !== undefined) {
    const existing =
      typeof promo.metadata === 'object' && promo.metadata !== null ? promo.metadata : {};
    // Merge so unrelated metadata (e.g. deactivationReason) survives edits.
    patch.metadata = { ...existing, ...updates.metadata };
  }
  return { ok: true, patch };
}

export function validateUpdatePromoCodeArgs(
  promo: {
    usedCount?: number;
    rewardAmount: number;
  },
  updates: {
    rewardAmount?: number;
    usageCap?: number;
  }
): { ok: true } | { ok: false; reason: string } {
  if (
    updates.usageCap !== undefined &&
    !isUnlimitedUsageCap(updates.usageCap) &&
    updates.usageCap < (promo.usedCount ?? 0)
  ) {
    return { ok: false, reason: 'usage_cap_below_used' };
  }
  if (
    updates.rewardAmount !== undefined &&
    updates.rewardAmount !== promo.rewardAmount &&
    (promo.usedCount ?? 0) > 0
  ) {
    return { ok: false, reason: 'reward_amount_locked' };
  }
  if (updates.rewardAmount !== undefined) {
    if (!Number.isFinite(updates.rewardAmount) || updates.rewardAmount > 1_000_000_000) {
      return { ok: false, reason: 'reward_amount_invalid' };
    }
    if (updates.rewardAmount <= 0) return { ok: false, reason: 'reward_amount_positive' };
    if (!Number.isInteger(updates.rewardAmount)) return { ok: false, reason: 'reward_amount_integer' };
  }
  if (updates.usageCap !== undefined) {
    if (!Number.isFinite(updates.usageCap) || updates.usageCap > 1_000_000_000) {
      return { ok: false, reason: 'usage_cap_invalid' };
    }
    if (!Number.isInteger(updates.usageCap)) return { ok: false, reason: 'usage_cap_integer' };
  }
  return { ok: true };
}

const MAX_WALLET_ADJUSTMENT = 1_000_000_000;

export function validateWalletAdjustment(args: {
  currentBalance: number;
  amount: number;
  reason: string;
}): { ok: true } | { ok: false; reason: string } {
  if (args.amount === 0) return { ok: false, reason: 'amount_nonzero' };
  if (!Number.isFinite(args.amount) || Math.abs(args.amount) > MAX_WALLET_ADJUSTMENT) {
    return { ok: false, reason: 'amount_invalid' };
  }
  if (!Number.isInteger(args.amount)) return { ok: false, reason: 'amount_integer' };
  if (!args.reason || args.reason.trim().length === 0) return { ok: false, reason: 'reason_required' };
  const newBalance = args.currentBalance + args.amount;
  if (newBalance < 0) return { ok: false, reason: 'insufficient_balance' };
  return { ok: true };
}
