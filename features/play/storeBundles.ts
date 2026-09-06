import type { TranslationKey } from '@/lib/i18n/messages/en';

export interface StoreBundle {
  id: string;
  nameKey: TranslationKey;
  tokens: number;
  bonus?: number;
  priceLabel: string;
  icon: string;
  featured?: boolean;
}

/** Convex catalog product shape (subset of payments.getCatalog return). */
export interface CatalogProduct {
  productKey: string;
  tokensGranted: number;
  iosProductId: string;
  androidProductId: string;
  /** Web (RC Billing) product identifier; only present on web catalog rows. */
  webProductId?: string;
  isActive: boolean;
  sortOrder: number;
}

/** Display bundle enriched with catalog and native store info. */
export interface DisplayBundle extends CatalogProduct {
  displayNameKey: TranslationKey;
  icon: string;
  isFeatured: boolean;
  /** Native store price string (e.g. "£4.99"), or fallback label. */
  priceLabel: string;
  /** Platform-specific store product ID for this bundle. */
  platformProductId: string | null;
}

/**
 * Static display metadata for the native token packs (iOS + Android). Prices
 * match the App Store / Play Console GBP prices. Web packs have their own
 * metadata below; the two stores no longer share packs.
 */
export const STORE_BUNDLES: StoreBundle[] = [
  {
    id: 'b10',
    nameKey: 'store.packQuick',
    tokens: 10,
    priceLabel: '£4.99',
    icon: 'flash-outline',
  },
  {
    id: 'b20',
    nameKey: 'store.packValue',
    tokens: 20,
    priceLabel: '£8.99',
    icon: 'layers-outline',
  },
  {
    id: 'b30',
    nameKey: 'store.packPro',
    tokens: 30,
    priceLabel: '£11.99',
    icon: 'star-outline',
    featured: true,
  },
  {
    id: 'b50',
    nameKey: 'store.packPower',
    tokens: 50,
    priceLabel: '£16.99',
    icon: 'rocket-outline',
  },
  {
    id: 'b70',
    nameKey: 'store.packMega',
    tokens: 70,
    priceLabel: '£20.99',
    icon: 'trophy-outline',
  },
];

/**
 * Static display metadata for the web token packs. Web sells its own packs at
 * its own GBP prices. Icons/name keys reuse the native set (they are only
 * layout/name fallbacks; price labels here are the web-specific ones).
 */
export const WEB_STORE_BUNDLES: StoreBundle[] = [
  {
    id: 'wb10',
    nameKey: 'store.packQuick',
    tokens: 10,
    priceLabel: '£2.99',
    icon: 'flash-outline',
  },
  {
    id: 'wb20',
    nameKey: 'store.packValue',
    tokens: 20,
    priceLabel: '£5.49',
    icon: 'layers-outline',
  },
  {
    id: 'wb40',
    nameKey: 'store.packPower',
    tokens: 40,
    priceLabel: '£9.99',
    icon: 'rocket-outline',
  },
  {
    id: 'wb70',
    nameKey: 'store.packMega',
    tokens: 70,
    priceLabel: '£15.49',
    icon: 'trophy-outline',
  },
  {
    id: 'wb100',
    nameKey: 'store.packPro',
    tokens: 100,
    priceLabel: '£19.99',
    icon: 'star-outline',
    featured: true,
  },
];

/** Lookup display metadata by token count (native packs). */
export const BUNDLE_DISPLAY_BY_TOKENS: Record<number, StoreBundle | undefined> =
  Object.fromEntries(STORE_BUNDLES.map((b) => [b.tokens, b]));

/** Lookup display metadata by token count (web packs). */
export const WEB_BUNDLE_DISPLAY_BY_TOKENS: Record<number, StoreBundle | undefined> =
  Object.fromEntries(WEB_STORE_BUNDLES.map((b) => [b.tokens, b]));

/** Formatter for token counts (e.g. 1,000 → "1,000"). */
export function formatTokens(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Restrict a catalog to the products that exist on a given platform.
 *
 * The Convex catalog now carries both product lines: native rows (ios/android
 * product ids) and web rows (webProductId). Web must only ever see the web
 * rows; iOS/Android must only see the native rows.
 */
export function catalogForPlatform(
  catalog: CatalogProduct[],
  platform: string
): CatalogProduct[] {
  const isWeb = platform === 'web';
  return catalog.filter(
    (p) =>
      p.isActive &&
      (isWeb
        ? !!p.webProductId
        : !p.webProductId && (!!p.iosProductId || !!p.androidProductId))
  );
}

/**
 * Maps a Convex catalog product array into display bundles by merging with
 * platform display metadata and (optionally) native store product prices.
 *
 * @param catalog    Products from the `payments.getCatalog` Convex query.
 * @param nativeProducts  Map of native product ID → { priceString? } from RevenueCat.
 * @param platform   Current platform ('ios' | 'android' | 'web' …).
 */
export function buildDisplayBundles(
  catalog: CatalogProduct[],
  nativeProducts: Record<string, { priceString?: string }>,
  platform: string
): DisplayBundle[] {
  const isWeb = platform === 'web';
  const displayByTokens = isWeb ? WEB_BUNDLE_DISPLAY_BY_TOKENS : BUNDLE_DISPLAY_BY_TOKENS;

  return catalogForPlatform(catalog, platform)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cp) => {
      const displayMeta = displayByTokens[cp.tokensGranted];
      const platformProductId = isWeb
        ? (cp.webProductId ?? null)
        : platform === 'ios'
          ? cp.iosProductId
          : platform === 'android'
            ? cp.androidProductId
            : null;
      const nativeProduct = platformProductId ? nativeProducts[platformProductId] : undefined;

      return {
        ...cp,
        displayNameKey: displayMeta?.nameKey ?? ('store.tokenCount' as const),
        icon: displayMeta?.icon ?? 'diamond-outline',
        isFeatured: displayMeta?.featured ?? false,
        priceLabel:
          nativeProduct?.priceString ?? displayMeta?.priceLabel ?? `${cp.tokensGranted} tokens`,
        platformProductId,
      };
    });
}
