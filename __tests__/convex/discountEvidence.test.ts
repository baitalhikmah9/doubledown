import { describe, expect, it } from '@jest/globals';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
  discountEvidenceMatches,
  normalizeDiscountPercentage,
} from '../../convex/lib/promoDiscountClaim';

const basePromo: Doc<'promo_codes'> = {
  // SAFETY: Controlled test boundary cast under fixture invariants.
  _id: 'promo_1' as Id<'promo_codes'>,
  _creationTime: 0,
  code: 'mikhail10',
  rewardType: 'discount',
  rewardAmount: 0,
  usageCap: 0,
  discountPercent: 10,
  productKey: 'bundle_50',
  revenueCatProvisioningStatus: 'provisioned',
  revenueCatDiscountIdentifier: 'promo_mikhail10',
};

describe('discountEvidenceMatches', () => {
  it('matches when the identifier and percentage both match', () => {
    expect(
      discountEvidenceMatches({
        promo: basePromo,
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 10,
      })
    ).toBe(true);
  });

  it('matches when the identifier matches and percentage is omitted', () => {
    expect(
      discountEvidenceMatches({
        promo: basePromo,
        appliedDiscountIdentifier: 'promo_mikhail10',
      })
    ).toBe(true);
  });

  it('rejects when the identifier does not match', () => {
    expect(
      discountEvidenceMatches({
        promo: basePromo,
        appliedDiscountIdentifier: 'wrong_identifier',
        appliedPercentage: 10,
      })
    ).toBe(false);
  });

  it('rejects when the applied identifier is missing', () => {
    expect(
      discountEvidenceMatches({
        promo: basePromo,
        appliedPercentage: 10,
      })
    ).toBe(false);
  });

  it('rejects when the configured identifier is missing (not provisioned)', () => {
    expect(
      discountEvidenceMatches({
        promo: { ...basePromo, revenueCatDiscountIdentifier: undefined },
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 10,
      })
    ).toBe(false);
  });

  it('rejects when the applied percentage differs from the configured one', () => {
    expect(
      discountEvidenceMatches({
        promo: basePromo,
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 50,
      })
    ).toBe(false);
  });

  it('matches when the configured percentage is missing but identifier matches', () => {
    expect(
      discountEvidenceMatches({
        promo: { ...basePromo, discountPercent: undefined },
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 10,
      })
    ).toBe(true);
  });

  // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
  it('matches when applied percentage is sent as a fraction 0.2 for configured 20%', () => {
    expect(
      discountEvidenceMatches({
        promo: { ...basePromo, discountPercent: 20 },
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 0.2,
      })
    ).toBe(true);
  });

  it('matches when applied percentage is sent as 20 for configured 20%', () => {
    expect(
      discountEvidenceMatches({
        promo: { ...basePromo, discountPercent: 20 },
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 20,
      })
    ).toBe(true);
  });

  it('rejects when applied percentage is 0.5 (50%) but configured is 20%', () => {
    expect(
      discountEvidenceMatches({
        promo: { ...basePromo, discountPercent: 20 },
        appliedDiscountIdentifier: 'promo_mikhail10',
        appliedPercentage: 0.5,
      })
    ).toBe(false);
  });
});

describe('normalizeDiscountPercentage', () => {
  it('normalizes 0..1 fractions to percent', () => {
    expect(normalizeDiscountPercentage(0.2)).toBe(20);
    expect(normalizeDiscountPercentage(0.5)).toBe(50);
    expect(normalizeDiscountPercentage(1)).toBe(100);
    expect(normalizeDiscountPercentage(0.15)).toBe(15);
  });

  it('keeps 1..100 values as-is (rounded)', () => {
    expect(normalizeDiscountPercentage(20)).toBe(20);
    expect(normalizeDiscountPercentage(50)).toBe(50);
    expect(normalizeDiscountPercentage(100)).toBe(100);
    expect(normalizeDiscountPercentage(33.5)).toBe(34);
  });

  it('returns undefined for non-numbers', () => {
    expect(normalizeDiscountPercentage(undefined)).toBeUndefined();
    expect(normalizeDiscountPercentage('20')).toBeUndefined();
    expect(normalizeDiscountPercentage(NaN)).toBeUndefined();
  });

  it('passes through values > 100 (caller exact-match will reject)', () => {
    expect(normalizeDiscountPercentage(150)).toBe(150);
  });
});
