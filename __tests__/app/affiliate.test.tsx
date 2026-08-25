import React from 'react';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import AffiliateDashboardScreen from '@/app/(admin)/affiliate';
import {
  __setConvexQueryResult,
  __resetConvexReactDouble,
} from '../doubles/convexReact';

describe('AffiliateDashboardScreen', () => {
  beforeEach(() => {
    __resetConvexReactDouble();
  });

  it('shows only assigned coupon stats and keeps currencies separate', () => {
    __setConvexQueryResult({
      codes: [
        {
          code: 'mikhail10',
          usageCount: 10000,
          rewardType: 'discount',
          discountPercent: 10,
          productKey: 'bundle_50',
          commissionPercent: 10,
          activeTo: null,
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
          totalSaleMicros: 16_000_000,
          totalCommissionMicros: 1_600_000,
        },
      ],
    });

    render(<AffiliateDashboardScreen />);

    expect(screen.getByText('MIKHAIL10')).toBeTruthy();
    expect(screen.getByText('10000')).toBeTruthy();
    expect(screen.getByText('16.00 GBP')).toBeTruthy();
  });
});
