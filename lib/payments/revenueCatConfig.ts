/**
 * RevenueCat identifiers - keep in sync with the RevenueCat dashboard.
 *
 * Products: App Store Connect / Play Console product IDs attached to offerings.
 */

/**
 * RevenueCat Test Store public API key (same value for iOS + Android test store).
 * Used for debug / local / EAS development builds so purchases hit Test Store, not App Store / Play.
 */
export const REVENUECAT_TEST_STORE_API_KEY = 'test_hbpxoGCDXRBRDjhBSdRMowxgIVL';

/** Token consumable store product IDs for iOS App Store and Google Play. Web now sells its own token packs via RC Billing; those identifiers live in the web catalog (convex/lib/paymentCatalog). */
export const REVENUECAT_TOKEN_PRODUCT_IDS = {
  tokens10: 'consumable',
  tokens20: 'consumable_2',
  tokens30: 'consumable_3',
  tokens50: 'consumable_4',
  tokens70: 'consumable_5',
} as const;
