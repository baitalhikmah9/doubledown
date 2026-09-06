export type PaymentStore = 'app_store' | 'play_store' | 'web_store' | 'test_store';

export interface TokenProductSeed {
  productKey: string;
  tokensGranted: number;
  iosProductId: string;
  androidProductId: string;
  /**
   * RevenueCat Web Billing (Stripe) product identifier. Only set for the
   * web token catalog. Native rows leave this unset and web used to reuse
   * the Android identifiers; that is no longer the case since the web
   * storefront sells its own token packs.
   */
  webProductId?: string;
  isActive: boolean;
  sortOrder: number;
}

/**
 * RevenueCat / store product identifiers for the native token consumables
 * (iOS App Store + Google Play). Unchanged: native keeps the original token
 * packs and prices while the web storefront moves to its own catalog.
 */
const NATIVE_STORE_PRODUCT_IDS = {
  tokens10: 'consumable',
  tokens20: 'consumable_2',
  tokens30: 'consumable_3',
  tokens50: 'consumable_4',
  tokens70: 'consumable_5',
} as const;

/**
 * RevenueCat Web Billing (Stripe) product identifiers for the web token
 * consumables. Created as consumable_v2_<tokens> so the identifier itself
 * states how many tokens the pack grants, distinct from the native set.
 */
const WEB_STORE_PRODUCT_IDS = {
  tokens10: 'consumable_v2_10',
  tokens20: 'consumable_v2_20',
  tokens40: 'consumable_v2_40',
  tokens70: 'consumable_v2_70',
  tokens100: 'consumable_v2_100',
} as const;

/**
 * Native token catalog (iOS + Android). Old packs, old identifiers, old
 * prices. Used as the fallback when no token_products rows are stored.
 */
export const DEFAULT_TOKEN_PRODUCTS: TokenProductSeed[] = [
  {
    productKey: 'bundle_10',
    tokensGranted: 10,
    iosProductId: NATIVE_STORE_PRODUCT_IDS.tokens10,
    androidProductId: NATIVE_STORE_PRODUCT_IDS.tokens10,
    isActive: true,
    sortOrder: 10,
  },
  {
    productKey: 'bundle_20',
    tokensGranted: 20,
    iosProductId: NATIVE_STORE_PRODUCT_IDS.tokens20,
    androidProductId: NATIVE_STORE_PRODUCT_IDS.tokens20,
    isActive: true,
    sortOrder: 20,
  },
  {
    productKey: 'bundle_30',
    tokensGranted: 30,
    iosProductId: NATIVE_STORE_PRODUCT_IDS.tokens30,
    androidProductId: NATIVE_STORE_PRODUCT_IDS.tokens30,
    isActive: true,
    sortOrder: 30,
  },
  {
    productKey: 'bundle_50',
    tokensGranted: 50,
    iosProductId: NATIVE_STORE_PRODUCT_IDS.tokens50,
    androidProductId: NATIVE_STORE_PRODUCT_IDS.tokens50,
    isActive: true,
    sortOrder: 40,
  },
  {
    productKey: 'bundle_70',
    tokensGranted: 70,
    iosProductId: NATIVE_STORE_PRODUCT_IDS.tokens70,
    androidProductId: NATIVE_STORE_PRODUCT_IDS.tokens70,
    isActive: true,
    sortOrder: 50,
  },
];

/**
 * Web token catalog (RevenueCat Web Billing). New packs at new prices with
 * their own RC Billing identifiers. ios/android ids are empty: this catalog
 * never appears on native stores.
 */
export const WEB_TOKEN_PRODUCTS: TokenProductSeed[] = [
  {
    productKey: 'web_bundle_10',
    tokensGranted: 10,
    iosProductId: '',
    androidProductId: '',
    webProductId: WEB_STORE_PRODUCT_IDS.tokens10,
    isActive: true,
    sortOrder: 10,
  },
  {
    productKey: 'web_bundle_20',
    tokensGranted: 20,
    iosProductId: '',
    androidProductId: '',
    webProductId: WEB_STORE_PRODUCT_IDS.tokens20,
    isActive: true,
    sortOrder: 20,
  },
  {
    productKey: 'web_bundle_40',
    tokensGranted: 40,
    iosProductId: '',
    androidProductId: '',
    webProductId: WEB_STORE_PRODUCT_IDS.tokens40,
    isActive: true,
    sortOrder: 30,
  },
  {
    productKey: 'web_bundle_70',
    tokensGranted: 70,
    iosProductId: '',
    androidProductId: '',
    webProductId: WEB_STORE_PRODUCT_IDS.tokens70,
    isActive: true,
    sortOrder: 40,
  },
  {
    productKey: 'web_bundle_100',
    tokensGranted: 100,
    iosProductId: '',
    androidProductId: '',
    webProductId: WEB_STORE_PRODUCT_IDS.tokens100,
    isActive: true,
    sortOrder: 50,
  },
];

/** Every catalog entry shipped with the repo (native + web defaults). */
export const ALL_DEFAULT_TOKEN_PRODUCTS: TokenProductSeed[] = [
  ...DEFAULT_TOKEN_PRODUCTS,
  ...WEB_TOKEN_PRODUCTS,
];

export function findTokenProductByStoreProductId(
  products: TokenProductSeed[],
  store: PaymentStore,
  productId: string
) {
  // Web uses RC Billing with its own identifiers. Web rows carry a
  // webProductId; legacy fallback to androidProductId keeps web purchases of
  // the old (pre-web-catalog) identifiers grantable during transition. Web
  // ids must win across the whole list: a native (stored) row whose
  // androidProductId collides with a web id is only a legacy alias, so run
  // two global passes (exact webProductId, then androidProductId fallback)
  // instead of a per-row OR that would let the first matching row win.
  if (store === 'web_store') {
    const webMatch = products.find(
      (product) => product.isActive && product.webProductId === productId
    );
    if (webMatch) {
      return webMatch;
    }
    return products.find(
      (product) => product.isActive && product.androidProductId === productId
    );
  }

  return products.find((product) => {
    if (!product.isActive) {
      return false;
    }

    if (store === 'test_store') {
      return product.iosProductId === productId || product.androidProductId === productId;
    }

    return store === 'app_store'
      ? product.iosProductId === productId
      : product.androidProductId === productId;
  });
}

/**
 * Resolve the RevenueCat product identifier used by web checkout for a given
 * product key. Web (RC Billing / Stripe) has its own catalog, so this returns
 * the webProductId of the matching web product. Falls back to the legacy
 * androidProductId mapping (native catalog) so discount promos created before
 * the web catalog split can still be provisioned against their RC products.
 */
export function getWebProductIdentifierForProductKey(
  products: TokenProductSeed[],
  productKey: string
): string | null {
  const web = products.find((p) => p.isActive && p.webProductId && p.productKey === productKey);
  if (web?.webProductId) {
    return web.webProductId;
  }
  const product = products.find((p) => p.isActive && p.productKey === productKey);
  return product ? product.androidProductId : null;
}

/**
 * Resolve the web product identifier for a product key using the default
 * catalogs (web catalog first, then the legacy native mapping). Convenience
 * wrapper for callers without a custom catalog.
 */
export function getDefaultWebProductIdentifierForProductKey(
  productKey: string
): string | null {
  return getWebProductIdentifierForProductKey(WEB_TOKEN_PRODUCTS, productKey) ??
    getWebProductIdentifierForProductKey(DEFAULT_TOKEN_PRODUCTS, productKey);
}

/**
 * Human label for a product key across both catalogs (e.g. "100-token
 * bundle"). Used by admin screens that surface discount promo targets.
 */
export function tokenProductKeyLabel(productKey: string): string {
  const product = ALL_DEFAULT_TOKEN_PRODUCTS.find((p) => p.productKey === productKey);
  return product ? `${product.tokensGranted}-token bundle` : productKey;
}
