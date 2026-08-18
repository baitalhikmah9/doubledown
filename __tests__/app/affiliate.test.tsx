import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import AffiliateDashboardScreen from '@/app/(admin)/affiliate';

const mockUseQuery = jest.fn<(...args: unknown[]) => unknown>();

jest.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => false, back: jest.fn(), replace: jest.fn() }),
}));

describe('AffiliateDashboardScreen', () => {
  it('shows only assigned coupon stats and keeps currencies separate', () => {
    mockUseQuery.mockReturnValue({
      codes: [
        {
          code: 'mikhail10',
          usageCount: 10000,
          rewardType: 'discount',
          discountPercent: 10,
          productKey: 'bundle_50',
          commissionPercent: 10,
          checkoutDiscountBlocked: true,
          earningsByCurrency: [
            {
              currencyCode: 'GBP',
              purchaseCount: 2,
              totalSaleMicros: 16_000_000,
              totalCommissionMicros: 1_600_000,
              averageSaleMicros: 8_000_000,
              averageCommissionMicros: 800_000,
            },
          ],
        },
      ],
    });

    render(<AffiliateDashboardScreen />);

    expect(screen.getByText('MIKHAIL10')).toBeTruthy();
    expect(screen.getByText('10000')).toBeTruthy();
    expect(screen.getByText('8.00 GBP')).toBeTruthy();
    expect(screen.getByText('0.80 GBP')).toBeTruthy();
    expect(screen.getByText('1.60 GBP')).toBeTruthy();
    expect(screen.queryByText('Promo Codes')).toBeNull();
    expect(screen.queryByText('Wallets')).toBeNull();
    expect(screen.queryByText('Audit Log')).toBeNull();
  });
});
