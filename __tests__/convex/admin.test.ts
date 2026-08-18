import { describe, expect, it } from '@jest/globals';
import {
  applyPromoCodeUpdate,
  derivePromoModeDefaults,
  derivePromoCodeStatus,
  validateCreatePromoCodeArgs,
  validateUpdatePromoCodeArgs,
  validateWalletAdjustment,
} from '@/convex/lib/adminValidation';
import {
  WALLET_TRANSACTION_SOURCES,
  WALLET_TRANSACTION_TYPES,
} from '@/convex/lib/walletTransactionTypes';

describe('adminValidation', () => {
  describe('derivePromoModeDefaults', () => {
    it('derives defaults for public single-use coupons', () => {
      expect(derivePromoModeDefaults({ mode: 'public_single_use' })).toEqual({
        ok: true,
        usageCap: 1,
        perUserLimit: 1,
        redemptionScope: 'public',
      });
    });

    it('derives defaults for public multi-use coupons', () => {
      expect(derivePromoModeDefaults({ mode: 'public_multi_use', requestedUsageCap: 25 })).toEqual({
        ok: true,
        usageCap: 25,
        perUserLimit: 1,
        redemptionScope: 'public',
      });
    });

    it('derives defaults for account single-use coupons', () => {
      expect(
        derivePromoModeDefaults({
          mode: 'account_single_use',
          restrictedToUserId: 'user_123',
        })
      ).toEqual({
        ok: true,
        usageCap: 1,
        perUserLimit: 1,
        redemptionScope: 'account',
      });
    });

    it('derives defaults for account multi-use coupons', () => {
      expect(
        derivePromoModeDefaults({
          mode: 'account_multi_use',
          requestedUsageCap: 4,
          restrictedToUserId: 'user_123',
        })
      ).toEqual({
        ok: true,
        usageCap: 4,
        perUserLimit: 4,
        redemptionScope: 'account',
      });
    });

    it('rejects account modes without a restricted user', () => {
      expect(derivePromoModeDefaults({ mode: 'account_single_use' })).toEqual({
        ok: false,
        reason: 'restricted_user_required',
      });
    });

    it('rejects public modes with a restricted user', () => {
      expect(
        derivePromoModeDefaults({
          mode: 'public_single_use',
          restrictedToUserId: 'user_123',
        })
      ).toEqual({ ok: false, reason: 'restricted_user_not_allowed' });
    });

    it('rejects multi-use modes without a non-negative cap', () => {
      expect(derivePromoModeDefaults({ mode: 'public_multi_use' })).toEqual({
        ok: false,
        reason: 'usage_cap_positive',
      });
      expect(
        derivePromoModeDefaults({
          mode: 'account_multi_use',
          requestedUsageCap: -1,
          restrictedToUserId: 'user_123',
        })
      ).toEqual({ ok: false, reason: 'usage_cap_positive' });
    });

    it('treats usage cap 0 as unlimited for multi-use modes', () => {
      expect(
        derivePromoModeDefaults({
          mode: 'public_multi_use',
          requestedUsageCap: 0,
        })
      ).toEqual({
        ok: true,
        usageCap: 0,
        perUserLimit: 1,
        redemptionScope: 'public',
      });
    });
  });

  describe('derivePromoCodeStatus', () => {
    it('returns active when promo is active, within window, and under cap', () => {
      expect(
        derivePromoCodeStatus({
          active: true,
          activeFrom: 100,
          activeTo: 500,
          usedCount: 3,
          usageCap: 10,
        }, 200)
      ).toBe('active');
    });

    it('returns inactive when active is false', () => {
      expect(
        derivePromoCodeStatus({
          active: false,
          usedCount: 0,
          usageCap: 10,
        }, 200)
      ).toBe('inactive');
    });

    it('returns scheduled when now is before activeFrom', () => {
      expect(
        derivePromoCodeStatus({
          active: true,
          activeFrom: 500,
          usedCount: 0,
          usageCap: 10,
        }, 200)
      ).toBe('scheduled');
    });

    it('returns expired when now is after activeTo', () => {
      expect(
        derivePromoCodeStatus({
          active: true,
          activeTo: 100,
          usedCount: 0,
          usageCap: 10,
        }, 200)
      ).toBe('expired');
    });

    it('returns exhausted when usedCount >= usageCap', () => {
      expect(
        derivePromoCodeStatus({
          active: true,
          usedCount: 10,
          usageCap: 10,
        }, 200)
      ).toBe('exhausted');
    });

    it('does not exhaust unlimited codes', () => {
      expect(
        derivePromoCodeStatus({
          active: true,
          usedCount: 10_000,
          usageCap: 0,
        }, 200)
      ).toBe('active');
    });
  });

  describe('validateCreatePromoCodeArgs', () => {
    it('accepts valid args', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'welcome2024',
          rewardAmount: 10,
          usageCap: 100,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: true });
    });

    it('rejects empty code', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: '',
          rewardAmount: 10,
          usageCap: 100,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: false, reason: 'code_required' });
    });

    it('rejects zero reward amount', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'test',
          rewardAmount: 0,
          usageCap: 100,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: false, reason: 'reward_amount_positive' });
    });

    it('rejects negative reward amount', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'test',
          rewardAmount: -5,
          usageCap: 100,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: false, reason: 'reward_amount_positive' });
    });

    it('rejects fractional reward amounts', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'test',
          rewardAmount: 1.5,
          usageCap: 100,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: false, reason: 'reward_amount_integer' });
    });

    it('rejects negative usage cap', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'test',
          rewardAmount: 10,
          usageCap: -1,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: false, reason: 'usage_cap_nonnegative' });
    });

    it('accepts unlimited usage cap 0', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'mikhail10',
          rewardAmount: 20,
          usageCap: 0,
          mode: 'public_multi_use',
        })
      ).toEqual({ ok: true });
    });

    it('accepts a bundle discount code', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'bundle20off',
          rewardAmount: 0,
          usageCap: 0,
          rewardType: 'discount',
          discountPercent: 20,
          productKey: 'bundle_50',
        })
      ).toEqual({ ok: true });
    });

    it('rejects a discount without a known bundle', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'bundle20off',
          rewardAmount: 0,
          usageCap: 0,
          rewardType: 'discount',
          discountPercent: 20,
          productKey: 'bundle_100',
        })
      ).toEqual({ ok: false, reason: 'product_key_invalid' });
    });

    it('requires commission when an affiliate email is set', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'mikhail10',
          rewardAmount: 0,
          usageCap: 0,
          rewardType: 'discount',
          discountPercent: 10,
          productKey: 'bundle_50',
          affiliateEmail: 'creator@example.com',
        })
      ).toEqual({ ok: false, reason: 'commission_percent_invalid' });
    });

    it('accepts an affiliate-bound discount code', () => {
      expect(
        validateCreatePromoCodeArgs({
          normalizedCode: 'mikhail10',
          rewardAmount: 0,
          usageCap: 0,
          rewardType: 'discount',
          discountPercent: 10,
          productKey: 'bundle_50',
          affiliateEmail: '  Creator@Example.com ',
          commissionPercent: 10,
        })
      ).toEqual({ ok: true });
    });
  });

  describe('validateUpdatePromoCodeArgs', () => {
    it('accepts valid updates', () => {
      expect(
        validateUpdatePromoCodeArgs(
          { usedCount: 3, rewardAmount: 10 },
          { usageCap: 5 }
        )
      ).toEqual({ ok: true });
    });

    it('rejects lowering usageCap below usedCount', () => {
      expect(
        validateUpdatePromoCodeArgs(
          { usedCount: 5, rewardAmount: 10 },
          { usageCap: 3 }
        )
      ).toEqual({ ok: false, reason: 'usage_cap_below_used' });
    });

    it('allows switching a used code to unlimited', () => {
      expect(
        validateUpdatePromoCodeArgs(
          { usedCount: 5, rewardAmount: 10 },
          { usageCap: 0 }
        )
      ).toEqual({ ok: true });
    });

    it('rejects changing rewardAmount after redemption', () => {
      expect(
        validateUpdatePromoCodeArgs(
          { usedCount: 1, rewardAmount: 10 },
          { rewardAmount: 20 }
        )
      ).toEqual({ ok: false, reason: 'reward_amount_locked' });
    });

    it('allows changing rewardAmount when no redemptions exist', () => {
      expect(
        validateUpdatePromoCodeArgs(
          { usedCount: 0, rewardAmount: 10 },
          { rewardAmount: 20 }
        )
      ).toEqual({ ok: true });
    });
  });

  describe('validateWalletAdjustment', () => {
    it('accepts a valid grant', () => {
      expect(
        validateWalletAdjustment({
          currentBalance: 10,
          amount: 5,
          reason: 'compensation',
        })
      ).toEqual({ ok: true });
    });

    it('accepts a valid debit with sufficient balance', () => {
      expect(
        validateWalletAdjustment({
          currentBalance: 10,
          amount: -5,
          reason: 'correction',
        })
      ).toEqual({ ok: true });
    });

    it('rejects zero amount', () => {
      expect(
        validateWalletAdjustment({
          currentBalance: 10,
          amount: 0,
          reason: 'test',
        })
      ).toEqual({ ok: false, reason: 'amount_nonzero' });
    });

    it('rejects empty reason', () => {
      expect(
        validateWalletAdjustment({
          currentBalance: 10,
          amount: 5,
          reason: '',
        })
      ).toEqual({ ok: false, reason: 'reason_required' });
    });

    it('rejects debit that would make balance negative', () => {
      expect(
        validateWalletAdjustment({
          currentBalance: 3,
          amount: -5,
          reason: 'refund',
        })
      ).toEqual({ ok: false, reason: 'insufficient_balance' });
    });
  });
});

describe('applyPromoCodeUpdate', () => {
  const promo = {
    rewardAmount: 100,
    usageCap: 50,
    perUserLimit: 5,
    activeFrom: 1_000,
    activeTo: 2_000,
    usedCount: 3,
    metadata: { campaignName: 'Camp', deactivationReason: 'abuse' },
  };

  it('preserves unrelated metadata (deactivationReason) when campaign/notes are edited', () => {
    const result = applyPromoCodeUpdate(promo, { metadata: { campaignName: 'Renamed' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.metadata).toEqual({
        campaignName: 'Renamed',
        deactivationReason: 'abuse',
      });
    }
  });

  it('clears activeFrom/activeTo via explicit flags', () => {
    const result = applyPromoCodeUpdate(promo, {
      clearActiveFrom: true,
      clearActiveTo: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toHaveProperty('activeFrom', undefined);
      expect(result.patch).toHaveProperty('activeTo', undefined);
    }
  });

  it('does not require an ordering check when both schedule fields are cleared', () => {
    const result = applyPromoCodeUpdate(promo, {
      clearActiveFrom: true,
      clearActiveTo: true,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects activeFrom on or after activeTo when both exist', () => {
    expect(applyPromoCodeUpdate(promo, { activeFrom: 2_000, activeTo: 1_500 })).toEqual({
      ok: false,
      reason: 'active_from_before_active_to',
    });
    expect(applyPromoCodeUpdate(promo, { activeFrom: 2_000, activeTo: 2_000 })).toEqual({
      ok: false,
      reason: 'active_from_before_active_to',
    });
  });

  it('allows editing one schedule bound without touching the other', () => {
    const result = applyPromoCodeUpdate(promo, { activeFrom: 500 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.activeFrom).toBe(500);
      expect(result.patch.activeTo).toBeUndefined();
    }
  });

  it('clears perUserLimit via explicit flag', () => {
    const result = applyPromoCodeUpdate(promo, { clearPerUserLimit: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toHaveProperty('perUserLimit', undefined);
    }
  });

  it('validates perUserLimit against the effective usage cap', () => {
    expect(applyPromoCodeUpdate(promo, { perUserLimit: 51 })).toEqual({
      ok: false,
      reason: 'per_user_limit_exceeds_cap',
    });
    // Clearing the limit while lowering the cap below the old limit is allowed.
    const result = applyPromoCodeUpdate(promo, { usageCap: 4, clearPerUserLimit: true });
    expect(result.ok).toBe(true);
  });

  it('rejects non-finite, non-integer, zero, and negative perUserLimit values', () => {
    expect(applyPromoCodeUpdate(promo, { perUserLimit: Infinity })).toEqual({
      ok: false,
      reason: 'per_user_limit_invalid',
    });
    expect(applyPromoCodeUpdate(promo, { perUserLimit: NaN })).toEqual({
      ok: false,
      reason: 'per_user_limit_invalid',
    });
    expect(applyPromoCodeUpdate(promo, { perUserLimit: 2.5 })).toEqual({
      ok: false,
      reason: 'per_user_limit_invalid',
    });
    expect(applyPromoCodeUpdate(promo, { perUserLimit: 0 })).toEqual({
      ok: false,
      reason: 'per_user_limit_invalid',
    });
    expect(applyPromoCodeUpdate(promo, { perUserLimit: -3 })).toEqual({
      ok: false,
      reason: 'per_user_limit_invalid',
    });
  });

  it('accepts a positive integer perUserLimit within the cap', () => {
    const result = applyPromoCodeUpdate(promo, { perUserLimit: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.perUserLimit).toBe(10);
    }
  });

  it('keeps rewardAmount locked once the code has redemptions', () => {
    expect(applyPromoCodeUpdate(promo, { rewardAmount: 200 })).toEqual({
      ok: false,
      reason: 'reward_amount_locked',
    });
  });
});

describe('validateCreatePromoCodeArgs schedule', () => {
  it('rejects activeFrom on or after activeTo', () => {
    expect(
      validateCreatePromoCodeArgs({
        normalizedCode: 'WELCOME',
        rewardAmount: 10,
        usageCap: 5,
        activeFrom: 2_000,
        activeTo: 1_000,
      })
    ).toEqual({ ok: false, reason: 'active_from_before_active_to' });
  });

  it('accepts a valid schedule', () => {
    expect(
      validateCreatePromoCodeArgs({
        normalizedCode: 'WELCOME',
        rewardAmount: 10,
        usageCap: 5,
        activeFrom: 1_000,
        activeTo: 2_000,
      })
    ).toEqual({ ok: true });
  });
});

describe('wallet transaction source and type constants', () => {
  it('exposes canonical source values used by the ledger', () => {
    expect(WALLET_TRANSACTION_SOURCES).toEqual(
      expect.arrayContaining(['purchase', 'gameplay', 'system', 'admin', 'promo'])
    );
    expect(WALLET_TRANSACTION_SOURCES).not.toEqual(
      expect.arrayContaining(['store', 'game'])
    );
  });

  it('covers every source/type value emitted by wallet_transactions inserts', () => {
    // Emitters: grantConsumablePurchase (purchase), wallet.ts (gameplay/system),
    // promo.ts (promo), admin.ts (admin), payments.ts (purchase/admin),
    // purchaserAccountMerge (system), accountDeletion (account_deletion).
    expect(WALLET_TRANSACTION_SOURCES).toEqual(
      expect.arrayContaining(['account_deletion'])
    );
    expect(WALLET_TRANSACTION_TYPES).toEqual(
      expect.arrayContaining([
        'purchase_grant',
        'purchase_reversal',
        'admin_adjustment',
        'starter_grant',
        'game_entry_reserve',
        'game_entry_adjust',
        'promo_redemption',
        'account_merge_debit',
        'account_merge_credit',
        'account_deletion_forfeit',
      ])
    );
  });
});
