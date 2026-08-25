import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';
import {
  clearWebRevenueCatConfig,
  configureWebRevenueCat,
  isWebBillingSupported,
  isWebPurchaseCancelledError,
  normalizeWebCustomerInfo,
} from '@/lib/payments/revenueCatWeb';
import {
  LogLevel,
  mockWebPurchasesInstance,
  __getPurchasesJsConfigureCalls,
  __getPurchasesJsSetLogLevelCalls,
  __resetPurchasesJsDouble,
} from '../doubles/revenueCatPurchasesJs';

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
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = originalPlatform;
  });

  it('isWebBillingSupported is true only on web with a key', () => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = 'ios';
    process.env[WEB_KEY] = 'rcb_live_key';
    expect(isWebBillingSupported()).toBe(false);

    // SAFETY: Controlled test fixture boundary cast.
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
          premium: {
            isActive: true,
            willRenew: false,
            expirationDate: null,
            productIdentifier: 'consumable',
          },
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

describe('configureWebRevenueCat lifecycle', () => {
  const originalPlatform = Platform.OS;
  const originalKey = process.env[WEB_KEY];

  beforeAll(() => {
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = 'web';
    process.env[WEB_KEY] = 'rcb_live_key';
    __resetPurchasesJsDouble();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env[WEB_KEY];
    else process.env[WEB_KEY] = originalKey;
    // SAFETY: Controlled test fixture boundary cast.
    (Platform as { OS: string }).OS = originalPlatform;
    clearWebRevenueCatConfig();
  });

  it('configures once, switches user on change, survives logout, rejects key change', async () => {
    clearWebRevenueCatConfig();
    __resetPurchasesJsDouble();

    await configureWebRevenueCat('user-a');
    expect(__getPurchasesJsConfigureCalls()).toBe(1);
    expect(__getPurchasesJsSetLogLevelCalls()).toEqual([LogLevel.Warn]);
    expect(mockWebPurchasesInstance.changeUser).not.toHaveBeenCalled();

    mockWebPurchasesInstance.changeUser.mockClear();
    await configureWebRevenueCat('user-a');
    expect(__getPurchasesJsConfigureCalls()).toBe(1);
    expect(mockWebPurchasesInstance.changeUser).not.toHaveBeenCalled();

    mockWebPurchasesInstance.changeUser.mockClear();
    await configureWebRevenueCat('user-b');
    expect(__getPurchasesJsConfigureCalls()).toBe(1);
    expect(mockWebPurchasesInstance.changeUser).toHaveBeenCalledTimes(1);
    expect(mockWebPurchasesInstance.changeUser).toHaveBeenCalledWith('user-b');

    // Logout clears configured user without destroying the SDK singleton.
    clearWebRevenueCatConfig();
    mockWebPurchasesInstance.changeUser.mockClear();
    await configureWebRevenueCat('user-c');
    expect(__getPurchasesJsConfigureCalls()).toBe(1);
    expect(mockWebPurchasesInstance.changeUser).toHaveBeenCalledWith('user-c');

    // Key change after configure is rejected.
    process.env[WEB_KEY] = 'rcb_other_key';
    await expect(configureWebRevenueCat('user-c')).rejects.toThrow(/page reload/i);
  });
});
