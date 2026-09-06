/**
 * RevenueCat Web Billing client for web token purchases.
 *
 * Uses `@revenuecat/purchases-js` directly (named exports `Purchases` and
 * `LogLevel`). On native platforms the RN SDK (`react-native-purchases`) is
 * used instead; see `revenueCat.ts`. This module is only imported on web so
 * the web SDK never loads in native bundles.
 *
 * Product strategy: web uses RevenueCat Billing (Stripe gateway) with its own
 * catalog of consumables (`consumable_v2_10`, …). RC Billing supports repeated
 * consumable purchases, unlike raw Stripe Billing. The web product ids come
 * from the web catalog rows' `webProductId`, not from the iOS/Android ids.
 *
 * Keys are read from `EXPO_PUBLIC_REVENUECAT_WEB_API_KEY` (env only, never
 * committed; prefix `rcb_` for live, `rcb_sb_` for sandbox). Mark the Vercel
 * env var Sensitive even though SDK keys are public.
 */

import { Platform } from 'react-native';

import type {
  CustomerInfoSnapshot,
  EntitlementSnapshot,
  PurchaseResult,
  StoreProductInfo,
} from './revenueCat';

// Lazy type-only view of the web SDK module surface (named exports).
interface WebPurchasesClass {
  configure: (config: { apiKey: string; appUserId: string }) => WebPurchasesInstance;
  setLogLevel: (level: number) => void;
  getSharedInstance: () => WebPurchasesInstance;
}

type WebLogLevel = { Silent: 0; Error: 1; Warn: 2; Info: 3; Debug: 4; Verbose: 5 };

type WebPurchasesModule = {
  Purchases: WebPurchasesClass;
  LogLevel: WebLogLevel;
};

interface WebProduct {
  identifier: string;
  title: string;
  description: string | null;
  price?: { formattedPrice?: string } | null;
}

interface WebPackage {
  identifier: string;
  webBillingProduct: WebProduct;
  webCheckoutURL?: string | null;
}

interface WebOffering {
  identifier: string;
  availablePackages: WebPackage[];
}

interface WebOfferings {
  current: WebOffering | null;
  all: Record<string, WebOffering>;
}

interface WebStoreTransaction {
  productIdentifier: string;
  storeTransactionId: string | null;
  store: string;
}

interface WebPurchaseResult {
  customerInfo: unknown;
  storeTransaction: WebStoreTransaction;
}

interface WebPurchasesInstance {
  getOfferings: (params?: unknown) => Promise<WebOfferings>;
  purchase: (params: WebPurchaseParams) => Promise<WebPurchaseResult>;
  purchasePackage: (rcPackage: WebPackage) => Promise<WebPurchaseResult>;
  getCustomerInfo: () => Promise<unknown>;
  changeUser: (newAppUserId: string) => Promise<unknown>;
}

/**
 * Parameters passed to the Web Billing SDK `purchase()` method. The SDK
 * supports `discountCode` and `showDiscountCodeField` (experimental) so a
 * validated code can be applied at checkout. The admin provisioning flow
 * creates the RevenueCat discount and code automatically, so no manual
 * dashboard or Stripe coupon setup is required for the charged price to
 * reflect the discount.
 */
interface WebPurchaseParams {
  rcPackage: WebPackage;
  discountCode?: string;
  showDiscountCodeField?: boolean;
}

let sdkPromise: Promise<WebPurchasesModule> | null = null;
let instance: WebPurchasesInstance | null = null;
let configuredApiKey: string | null = null;
let configuredAppUserId: string | null = null;

function getWebApiKey(): string | undefined {
  const value = process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function isWebBillingSupported(): boolean {
  return Platform.OS === 'web' && !!getWebApiKey();
}

async function loadWebSdk(): Promise<WebPurchasesModule> {
  if (!sdkPromise) {
    // Deferred require (not dynamic import) so Jest without
    // --experimental-vm-modules can resolve it. The .then() keeps the load
    // async and off the native critical path; on native this module is never
    // imported so the require never runs.
    sdkPromise = Promise.resolve().then(() =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest lacks experimental VM modules; native never imports this web module.
      require('@revenuecat/purchases-js') as WebPurchasesModule
    );
  }
  return sdkPromise;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function normalizeEntitlement(
  identifier: string,
  entitlement: Record<string, unknown> | null
): EntitlementSnapshot {
  return {
    identifier,
    isActive: entitlement?.isActive === true,
    willRenew: entitlement?.willRenew === true,
    expirationDate:
      typeof entitlement?.expirationDate === 'string' ? entitlement.expirationDate : null,
    productIdentifier:
      typeof entitlement?.productIdentifier === 'string'
        ? entitlement.productIdentifier
        : null,
  };
}

/** Reuses the shared CustomerInfoSnapshot shape from the native module. */
export function normalizeWebCustomerInfo(customerInfo: unknown): CustomerInfoSnapshot {
  const info = asRecord(customerInfo);
  const entitlementsRoot = asRecord(info?.entitlements);
  const active = asRecord(entitlementsRoot?.active) ?? {};
  const all = asRecord(entitlementsRoot?.all) ?? active;

  const entitlements: Record<string, EntitlementSnapshot> = {};
  for (const [identifier, entitlement] of Object.entries(all)) {
    entitlements[identifier] = normalizeEntitlement(identifier, asRecord(entitlement));
  }

  return {
    activeEntitlementIds: Object.entries(active)
      .filter(([, entitlement]) => asRecord(entitlement)?.isActive === true)
      .map(([identifier]) => identifier),
    entitlements,
    raw: customerInfo,
  };
}

/**
 * Configure the web SDK once per page session, then switch users as they
 * change. `Purchases.configure()` must run only once; subsequent user changes
 * (including logout → login) call `instance.changeUser(appUserId)`, the
 * documented method for switching known users (unlike the experimental
 * `identifyUser`, which aliases anonymous IDs). If the API key differs from
 * the one the singleton was built with, we throw; the SDK static singleton
 * cannot be safely reconfigured in-page, so a reload is required.
 */
export async function configureWebRevenueCat(appUserId: string): Promise<WebPurchasesInstance> {
  if (Platform.OS !== 'web') {
    throw new Error('RevenueCat Web Billing is only available on web.');
  }

  const apiKey = getWebApiKey();
  if (!apiKey) {
    throw new Error(
      'RevenueCat Web Billing is not configured. Set EXPO_PUBLIC_REVENUECAT_WEB_API_KEY.'
    );
  }

  if (!appUserId.trim()) {
    throw new Error('RevenueCat app user id is required.');
  }

  // Already configured with the same key: just switch the user id if it changed.
  if (instance && configuredApiKey === apiKey) {
    if (configuredAppUserId !== appUserId) {
      await instance.changeUser(appUserId);
      configuredAppUserId = appUserId;
    }
    return instance;
  }

  // API key differs from the configured singleton; cannot reconfigure in-page.
  if (instance && configuredApiKey !== apiKey) {
    throw new Error(
      'RevenueCat Web Billing API key changed after configuration. A page reload is required.'
    );
  }

  // First-time configuration.
  const sdk = await loadWebSdk();
  const Purchases = sdk.Purchases;

  if (typeof Purchases?.configure !== 'function') {
    throw new Error('RevenueCat Web SDK did not expose Purchases.configure().');
  }

  try {
    // LogLevel is a named module export, not a static on Purchases.
    Purchases.setLogLevel(sdk.LogLevel.Warn);
  } catch {
    // setLogLevel is best-effort; ignore failures.
  }

  instance = Purchases.configure({ apiKey, appUserId });
  configuredApiKey = apiKey;
  configuredAppUserId = appUserId;
  return instance;
}

/**
 * Clear the active user marker on logout, but keep the configured singleton
 * (the SDK static singleton remains configured for the page session). The next
 * `configureWebRevenueCat(appUserId)` call will `changeUser` to the new user.
 */
export function clearWebRevenueCatConfig(): void {
  configuredAppUserId = null;
}

/**
 * Fetch web store products by RC Billing product id. The web storefront has
 * its own catalog, so callers pass the web catalog `webProductId` values
 * (e.g. `consumable_v2_10`), which must exist in an RC Billing offering.
 */
export async function getWebStoreProducts(
  productIds: string[]
): Promise<StoreProductInfo[]> {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueProductIds.length === 0) return [];

  const active = instance;
  if (!active) {
    throw new Error('RevenueCat Web SDK is not configured. Call configureWebRevenueCat first.');
  }

  const offerings = await active.getOfferings();
  const packages = [
    ...(offerings.current?.availablePackages ?? []),
    ...Object.values(offerings.all ?? {}).flatMap((o) => o.availablePackages),
  ];

  const wanted = new Set(uniqueProductIds);
  return packages
    .filter((pkg) => wanted.has(pkg.webBillingProduct.identifier))
    .map((pkg) => ({
      identifier: pkg.webBillingProduct.identifier,
      title: pkg.webBillingProduct.title,
      description: pkg.webBillingProduct.description ?? undefined,
      priceString: pkg.webBillingProduct.price?.formattedPrice ?? undefined,
      raw: pkg,
    }));
}

/**
 * Initiate a web purchase for a resolved store product (opens Stripe checkout
 * via RC Billing). Returns the real store transaction id from the SDK; never
 * synthesizes a fake id. If the SDK omits the transaction id, the caller must
 * treat the purchase as pending and rely on the webhook for authoritative grant.
 *
 * When `discountCode` is supplied, it is forwarded to the RC Web Billing
 * checkout as the initial applied code. The percentage discount is applied by
 * RevenueCat because the admin flow provisions the discount + code in
 * RevenueCat automatically (no manual dashboard or Stripe coupon setup). The
 * server-side pending claim (created by promo.applyPromoCode) is matched
 * against the webhook event, which is the authoritative source: attribution
 * and commission are only recorded when the webhook confirms the configured
 * discount was applied to the purchase.
 */
export async function purchaseWebProduct(
  product: StoreProductInfo,
  options?: { discountCode?: string }
): Promise<PurchaseResult> {
  const active = instance;
  if (!active) {
    throw new Error('RevenueCat Web SDK is not configured. Call configureWebRevenueCat first.');
  }

  const pkg = product.raw as WebPackage;
  const discountCode = options?.discountCode?.trim() || undefined;
  // showDiscountCodeField is false so the user cannot replace the server-
  // validated code with a different one in the checkout. The code is fixed to
  // the one validated by promo.applyPromoCode.
  const result = await active.purchase({
    rcPackage: pkg,
    discountCode,
    showDiscountCodeField: false,
  });

  const transactionId =
    typeof result.storeTransaction?.storeTransactionId === 'string'
      ? result.storeTransaction.storeTransactionId
      : null;

  return {
    productIdentifier: product.identifier,
    transactionId,
    store: 'web_store',
    customerInfo: normalizeWebCustomerInfo(result.customerInfo),
  };
}

/** Restore web purchases by refetching customer info. */
export async function restoreWebPurchases(): Promise<CustomerInfoSnapshot> {
  const active = instance;
  if (!active) {
    throw new Error('RevenueCat Web SDK is not configured. Call configureWebRevenueCat first.');
  }

  const customerInfo = await active.getCustomerInfo();
  return normalizeWebCustomerInfo(customerInfo);
}

/** Identify the current purchaser in the web SDK (call on auth changes). */
export async function identifyWebUser(appUserId: string): Promise<void> {
  if (!appUserId.trim()) {
    throw new Error('RevenueCat app user id is required.');
  }

  if (configuredAppUserId === appUserId && instance) {
    return;
  }

  // configureWebRevenueCat reconfigures when the user id changes.
  await configureWebRevenueCat(appUserId);
}

export function isWebPurchaseCancelledError(cause: unknown): boolean {
  const err = cause as Record<string, unknown>;
  if (err?.userCancelled === true) return true;
  const code = err?.errorCode;
  // ErrorCode.UserCancelledError === 1 in the web SDK.
  return code === 'UserCancelledError' || code === 1;
}
