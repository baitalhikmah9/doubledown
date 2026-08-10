import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

// jest.mock is hoisted above imports by babel. The factory provides the named
// exports `Purchases` (class with static configure/setLogLevel/getSharedInstance)
// and `LogLevel` (enum) that `revenueCatWeb.ts` consumes via dynamic import.
// Under jest-expo's babel transform, dynamic import() becomes require(), so the
// mock is intercepted at module load time.
const mockInstance = {
  changeUser: jest.fn<(newAppUserId: string) => Promise<void>>().mockResolvedValue(undefined),
  getOfferings: jest.fn<() => Promise<{ current: null; all: Record<string, never> }>>().mockResolvedValue({ current: null, all: {} }),
  purchase: jest.fn(),
  getCustomerInfo: jest.fn(),
  purchasePackage: jest.fn(),
};

let configureCalls = 0;
const setLogLevelCalls: unknown[] = [];

jest.mock('@revenuecat/purchases-js', () => ({
  Purchases: {
    configure: jest.fn(() => {
      configureCalls += 1;
      return mockInstance;
    }),
    setLogLevel: jest.fn((level: unknown) => {
      setLogLevelCalls.push(level);
    }),
    getSharedInstance: jest.fn(() => mockInstance),
  },
  LogLevel: { Silent: 0, Error: 1, Warn: 2, Info: 3, Debug: 4, Verbose: 5 },
}));

import {
  clearWebRevenueCatConfig,
  configureWebRevenueCat,
  isWebBillingSupported,
  isWebPurchaseCancelledError,
  normalizeWebCustomerInfo,
} from '@/lib/payments/revenueCatWeb';

const WEB_KEY = 'EXPO_PUBLIC_REVENUECAT_WEB_API_KEY';

describe('revenueCatWeb helpers', () => {
  const originalPlatform = Platform.OS;
  const originalKey = process.env[WEB_KEY];

  beforeEach(() => {
    delete process.env[WEB_KEY];
    clearWebRevenueCatConfig();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env[WEB_KEY];
    else process.env[WEB_KEY] = originalKey;
    (Platform as { OS: string }).OS = originalPlatform;
  });

  it('isWebBillingSupported is true only on web with a key', () => {
    (Platform as { OS: string }).OS = 'ios';
    process.env[WEB_KEY] = 'rcb_live_key';
    expect(isWebBillingSupported()).toBe(false);

    (Platform as { OS: string }).OS = 'web';
    expect(isWebBillingSupported()).toBe(true);

    delete process.env[WEB_KEY];
    expect(isWebBillingSupported()).toBe(false);
  });

  it('normalizes web customer info into the shared snapshot shape', () => {
    const snapshot = normalizeWebCustomerInfo({
      entitlements: {
        active: { premium: { isActive: true } },
        all: {
          premium: { isActive: true, willRenew: false, expirationDate: null, productIdentifier: 'consumable' },
        },
      },
    });

    expect(snapshot.activeEntitlementIds).toEqual(['premium']);
    expect(snapshot.entitlements['premium']).toEqual({
      identifier: 'premium',
      isActive: true,
      willRenew: false,
      expirationDate: null,
      productIdentifier: 'consumable',
    });
  });

  it('detects web purchase cancellation errors', () => {
    expect(isWebPurchaseCancelledError({ userCancelled: true })).toBe(true);
    expect(isWebPurchaseCancelledError({ errorCode: 'UserCancelledError' })).toBe(true);
    expect(isWebPurchaseCancelledError({ errorCode: 1 })).toBe(true);
    expect(isWebPurchaseCancelledError({ errorCode: 'OtherError' })).toBe(false);
  });
});

// ── Configure-once + changeUser lifecycle (single sequential test) ─────
//
// `clearWebRevenueCatConfig()` intentionally retains the SDK singleton, so
// first-configure state cannot be restored per-test. All lifecycle assertions
// run in one ordered test that walks configure → user change → same user →
// logout/login → key change.

describe('configureWebRevenueCat lifecycle', () => {
  const originalPlatform = Platform.OS;
  const originalKey = process.env[WEB_KEY];

  beforeAll(() => {
    (Platform as { OS: string }).OS = 'web';
    process.env[WEB_KEY] = 'rcb_live_key';
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env[WEB_KEY];
    else process.env[WEB_KEY] = originalKey;
    (Platform as { OS: string }).OS = originalPlatform;
  });

  it('configures once, switches user on change, survives logout, rejects key change', async () => {
    // 1. First configuration → Purchases.configure() runs once, log level set.
    await configureWebRevenueCat('user-a');
    expect(configureCalls).toBe(1);
    expect(setLogLevelCalls).toEqual([2]); // LogLevel.Warn === 2
    expect(mockInstance.changeUser).not.toHaveBeenCalled();

    // 2. Same user reconfigured → no configure, no changeUser.
    mockInstance.changeUser.mockClear();
    await configureWebRevenueCat('user-a');
    expect(configureCalls).toBe(1);
    expect(mockInstance.changeUser).not.toHaveBeenCalled();

    // 3. User changes → changeUser called, no second configure.
    mockInstance.changeUser.mockClear();
    await configureWebRevenueCat('user-b');
    expect(configureCalls).toBe(1);
    expect(mockInstance.changeUser).toHaveBeenCalledTimes(1);
    expect(mockInstance.changeUser).toHaveBeenCalledWith('user-b');

    // 4. Logout (clear) then login as a new user → singleton retained, so
    //    changeUser is called, not configure.
    clearWebRevenueCatConfig();
    mockInstance.changeUser.mockClear();
    await configureWebRevenueCat('user-c');
    expect(configureCalls).toBe(1);
    expect(mockInstance.changeUser).toHaveBeenCalledWith('user-c');

    // 5. API key changes after configuration → throws (reload required).
    process.env[WEB_KEY] = 'rcb_different_key';
    await expect(configureWebRevenueCat('user-d')).rejects.toThrow(
      /API key changed after configuration/
    );
    expect(configureCalls).toBe(1); // still no second configure
    process.env[WEB_KEY] = 'rcb_live_key'; // restore
  });
});
