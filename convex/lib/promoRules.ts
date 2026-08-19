/**
 * Pure promo validation (case-insensitive codes, caps, windows).
 */

export function normalizePromoCode(code: string): string {
  return code.trim().toLowerCase();
}

export const UNLIMITED_USAGE_CAP = 0;

const PROMO_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isUnlimitedUsageCap(usageCap: number): boolean {
  return usageCap === UNLIMITED_USAGE_CAP;
}

export function generatePromoCode(length = 8, random = Math.random): string {
  const size = Math.max(1, Math.floor(length));
  let code = '';
  for (let i = 0; i < size; i++) {
    const index = Math.floor(random() * PROMO_CODE_ALPHABET.length);
    code += PROMO_CODE_ALPHABET[index] ?? 'X';
  }
  return code;
}

/**
 * RevenueCat discount code pattern. Provider codes must match ^[A-Za-z0-9_]+$.
 * Local codes are stored lowercase and case-insensitive, but the canonical
 * uppercase form is sent to RevenueCat.
 */
const REVENUECAT_DISCOUNT_CODE_PATTERN = /^[A-Za-z0-9_]+$/;

/**
 * Validate a raw (pre-normalization) discount code against the RevenueCat
 * provider pattern. Returns false for empty, whitespace, or characters
 * outside [A-Za-z0-9_]. The check is case-insensitive in spirit: any case
 * passes because the pattern allows both, and we send uppercase to RevenueCat.
 */
export function isValidDiscountCodeFormat(rawCode: string): boolean {
  const trimmed = rawCode.trim();
  if (trimmed.length === 0) return false;
  return REVENUECAT_DISCOUNT_CODE_PATTERN.test(trimmed);
}

/**
 * Canonical uppercase form sent to RevenueCat. Local storage stays lowercase
 * (via normalizePromoCode) for case-insensitive lookups.
 */
export function toProviderDiscountCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export type PromoFailure =
  | 'inactive'
  | 'expired'
  | 'not_yet_active'
  | 'usage_cap'
  | 'per_user_cap'
  | 'already_redeemed'
  | 'account_restricted'
  | 'discount_product_mismatch'
  | 'discount_checkout_unavailable';

export type PromoEvaluation = { ok: true } | { ok: false; reason: PromoFailure };

export function evaluatePromoRedemption(input: {
  active: boolean;
  now: number;
  activeFrom?: number;
  activeTo?: number;
  usedCount: number;
  usageCap: number;
  userRedemptionCount: number;
  perUserLimit: number;
}): PromoEvaluation {
  if (input.active === false) return { ok: false, reason: 'inactive' };
  if (input.activeFrom !== undefined && input.now < input.activeFrom) {
    return { ok: false, reason: 'not_yet_active' };
  }
  if (input.activeTo !== undefined && input.now > input.activeTo) {
    return { ok: false, reason: 'expired' };
  }
  if (!isUnlimitedUsageCap(input.usageCap) && input.usedCount >= input.usageCap) {
    return { ok: false, reason: 'usage_cap' };
  }
  if (input.userRedemptionCount >= input.perUserLimit) return { ok: false, reason: 'per_user_cap' };
  return { ok: true };
}

export function evaluatePromoRewardType(rewardType: string): PromoEvaluation {
  // Discount codes are validated and claimed via the unified web coupon path
  // (promo.applyPromoCode), which creates a pending claim for the configured
  // product and provisions the discount + code in RevenueCat automatically.
  // The legacy redeemCode path still rejects them because it would grant
  // tokens, which discount codes never do.
  if (rewardType !== 'tokens' && rewardType !== 'discount') {
    return { ok: false, reason: 'discount_checkout_unavailable' };
  }
  return { ok: true };
}

export function evaluateDiscountProductRestriction(input: {
  rewardType: string;
  promoProductKey?: string;
  requestedProductKey: string;
}): PromoEvaluation {
  if (input.rewardType !== 'discount') return { ok: true };
  if (!input.promoProductKey || input.promoProductKey !== input.requestedProductKey) {
    return { ok: false, reason: 'discount_product_mismatch' };
  }
  return { ok: true };
}

export function evaluateDuplicateRedemption(alreadyRedeemed: boolean): PromoEvaluation {
  if (alreadyRedeemed) return { ok: false, reason: 'already_redeemed' };
  return { ok: true };
}

export function evaluatePromoAccountRestriction(input: {
  redemptionScope?: string;
  restrictedToUserId?: string;
  restrictedToPurchaserAccountId?: string;
  currentUserId: string;
  currentPurchaserAccountId?: string | null;
}): PromoEvaluation {
  if (
    input.redemptionScope === 'account' &&
    input.restrictedToUserId !== input.currentUserId
  ) {
    return { ok: false, reason: 'account_restricted' };
  }

  // Enforce purchaser pin whenever stored, even if scope is public (admin may set both).
  if (
    input.restrictedToPurchaserAccountId !== undefined &&
    input.restrictedToPurchaserAccountId !== input.currentPurchaserAccountId
  ) {
    return { ok: false, reason: 'account_restricted' };
  }

  return { ok: true };
}
