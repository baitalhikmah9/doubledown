/** Controllable `@revenuecat/purchases-js` double for web billing tests. */

export const mockWebPurchasesInstance = {
  changeUser: jest.fn(async (_newAppUserId: string) => undefined),
  getOfferings: jest.fn(async () => ({ current: null, all: {} })),
  purchase: jest.fn(),
  getCustomerInfo: jest.fn(),
  purchasePackage: jest.fn(),
};

let configureCalls = 0;
const setLogLevelCalls: number[] = [];

export const Purchases = {
  configure: jest.fn(() => {
    configureCalls += 1;
    return mockWebPurchasesInstance;
  }),
  setLogLevel: jest.fn((level: number) => {
    setLogLevelCalls.push(level);
  }),
  getSharedInstance: jest.fn(() => mockWebPurchasesInstance),
};

export const LogLevel = {
  Silent: 0,
  Error: 1,
  Warn: 2,
  Info: 3,
  Debug: 4,
  Verbose: 5,
} as const;

export function __getPurchasesJsConfigureCalls(): number {
  return configureCalls;
}

export function __getPurchasesJsSetLogLevelCalls(): readonly number[] {
  return setLogLevelCalls;
}

export function __resetPurchasesJsDouble(): void {
  configureCalls = 0;
  setLogLevelCalls.length = 0;
  Purchases.configure.mockClear();
  Purchases.setLogLevel.mockClear();
  Purchases.getSharedInstance.mockClear();
  mockWebPurchasesInstance.changeUser.mockReset();
  mockWebPurchasesInstance.changeUser.mockResolvedValue(undefined);
  mockWebPurchasesInstance.getOfferings.mockReset();
  mockWebPurchasesInstance.getOfferings.mockResolvedValue({ current: null, all: {} });
  mockWebPurchasesInstance.purchase.mockReset();
  mockWebPurchasesInstance.getCustomerInfo.mockReset();
  mockWebPurchasesInstance.purchasePackage.mockReset();
}
