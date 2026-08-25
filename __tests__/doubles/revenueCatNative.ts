/** Controllable `@/lib/payments/revenueCat` double for screen tests. */

export const STORE_PRODUCTS_UNAVAILABLE_ERROR =
  'Store products are temporarily unavailable. Please try again shortly.';

export const configureRevenueCatOnce = jest.fn(async () => undefined);
export const logOutRevenueCat = jest.fn(async () => undefined);
export const getRevenueCatSession = jest.fn(() => ({
  appUserId: null,
  ready: false,
  error: null,
}));
export const clearRevenueCatSessionState = jest.fn();
export const purchaseStoreProduct = jest.fn();
export const getStoreProducts = jest.fn(async () => []);
export const restorePurchases = jest.fn(async () => ({
  activeEntitlementIds: [],
  entitlements: {},
  raw: {},
}));

export function __resetRevenueCatNativeDouble(): void {
  configureRevenueCatOnce.mockReset();
  configureRevenueCatOnce.mockResolvedValue(undefined);
  logOutRevenueCat.mockReset();
  logOutRevenueCat.mockResolvedValue(undefined);
  getRevenueCatSession.mockReset();
  getRevenueCatSession.mockReturnValue({ appUserId: null, ready: false, error: null });
  clearRevenueCatSessionState.mockClear();
  purchaseStoreProduct.mockReset();
  getStoreProducts.mockReset();
  getStoreProducts.mockResolvedValue([]);
  restorePurchases.mockReset();
  restorePurchases.mockResolvedValue({
    activeEntitlementIds: [],
    entitlements: {},
    raw: {},
  });
}
