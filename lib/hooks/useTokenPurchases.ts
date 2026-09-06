import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  getMissingStoreProductIds,
  getStoreProducts,
  isPurchaseCancelledError,
  isRevenueCatSupported,
  purchaseStoreProduct,
  resolvePlatformProductIds,
  STORE_PRODUCTS_UNAVAILABLE_ERROR,
  subscribeRevenueCatSession,
  type PurchaseResult,
  type RevenueCatSessionState,
  type StoreProductInfo,
} from '@/lib/payments/revenueCat';
import {
  configureWebRevenueCat,
  getWebStoreProducts,
  isWebBillingSupported,
  isWebPurchaseCancelledError,
  purchaseWebProduct,
} from '@/lib/payments/revenueCatWeb';
import { usePlayStore } from '@/store/play';

export interface TokenCatalogProduct {
  productKey: string;
  tokensGranted: number;
  iosProductId: string;
  androidProductId: string;
  /** Web (RC Billing) product identifier for the web catalog rows. */
  webProductId?: string;
  sortOrder: number;
}

export interface TokenPurchaseOutcome extends PurchaseResult {
  granted: boolean;
  pending: boolean;
  tokensGranted: number;
  balance: number | null;
}

interface UseTokenPurchasesOptions {
  catalog?: TokenCatalogProduct[];
  enabled: boolean;
}

/**
 * Fetches native store prices and initiates purchases.
 *
 * RevenueCat is configured and identified globally via `useRevenueCatSync`.
 * After a successful Test Store purchase, grants tokens via Convex immediately.
 */
export function useTokenPurchases({ catalog, enabled }: UseTokenPurchasesOptions) {
  const syncConsumablePurchase = useMutation(api.payments.syncConsumablePurchase);
  const setTokenBalance = usePlayStore((state) => state.setTokenBalance);
  const [session, setSession] = useState<RevenueCatSessionState>({
    appUserId: null,
    ready: false,
    error: null,
  });
  const [products, setProducts] = useState<Record<string, StoreProductInfo>>({});
  const [isReady, setIsReady] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedKeyRef = useRef<string | null>(null);

  const platformProductIds = useMemo(
    () => (catalog ? resolvePlatformProductIds(catalog) : []),
    [catalog]
  );

  useEffect(() => subscribeRevenueCatSession(setSession), []);

  useEffect(() => {
    if (!enabled || !isRevenueCatSupported()) return;
    if (!session.ready || !session.appUserId) return;
    if (platformProductIds.length === 0) return;

    const key = `${session.appUserId}:${JSON.stringify(platformProductIds)}`;
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;

    let cancelled = false;
    setIsReady(false);
    setError(session.error);

    const isWeb = isWebBillingSupported();

    // Web: configure the Web Billing SDK for this purchaser, then fetch offerings.
    const fetchPromise = isWeb
      ? configureWebRevenueCat(session.appUserId).then(() =>
          getWebStoreProducts(platformProductIds)
        )
      : getStoreProducts(platformProductIds);

    void fetchPromise
      .then((storeProducts) => {
        if (cancelled) return;

        const productMap: Record<string, StoreProductInfo> = {};
        for (const sp of storeProducts) {
          productMap[sp.identifier] = sp;
        }
        setProducts(productMap);
        const missingProductIds = getMissingStoreProductIds(platformProductIds, storeProducts);
        setIsReady(missingProductIds.length === 0);
        setError(missingProductIds.length === 0 ? null : STORE_PRODUCTS_UNAVAILABLE_ERROR);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load store products.');
          setIsReady(false);
          fetchedKeyRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, platformProductIds, session.appUserId, session.error, session.ready]);

  const purchase = useCallback(
    async (
      catalogProduct: TokenCatalogProduct,
      options?: { discountCode?: string }
    ): Promise<TokenPurchaseOutcome> => {
      if (!enabled) throw new Error('Purchases are not enabled.');
      if (!isRevenueCatSupported())
        throw new Error('Purchases are only available in the iOS, Android, and web apps.');
      if (!session.ready || !session.appUserId) {
        throw new Error('Purchases are still loading.');
      }

      const isWeb = isWebBillingSupported();
      const productId = isWeb
        ? (catalogProduct.webProductId || catalogProduct.androidProductId)
        : Platform.OS === 'ios'
          ? catalogProduct.iosProductId
          : catalogProduct.androidProductId;

      if (!productId) {
        throw new Error('This product is not available on this platform.');
      }

      const product = products[productId] ??
        (isWeb
          ? (await getWebStoreProducts([productId]))[0]
          : (await getStoreProducts([productId]))[0]);
      if (!product) {
        throw new Error(STORE_PRODUCTS_UNAVAILABLE_ERROR);
      }

      setIsPurchasing(true);
      setError(null);
      try {
        const purchaseResult = isWeb
          ? await purchaseWebProduct(product, { discountCode: options?.discountCode })
          : await purchaseStoreProduct(product);

        // Web purchases are webhook-authoritative: the client never forges a
        // transaction id. If the SDK returned a real id, record it via sync so
        // the backend can de-duplicate; if not, skip sync and rely on the webhook.
        if (isWeb) {
          const realTransactionId = purchaseResult.transactionId?.trim() ?? null;
          if (!realTransactionId) {
            // No transaction id yet; the grant comes from the RC webhook.
            return {
              ...purchaseResult,
              transactionId: null,
              granted: false,
              pending: true,
              tokensGranted: 0,
              balance: null,
            };
          }

          try {
            const sync = await syncConsumablePurchase({
              purchaserAccountId: session.appUserId,
              productId: product.identifier,
              transactionId: realTransactionId,
              store: purchaseResult.store,
            });

            if (sync.balance != null) {
              setTokenBalance(sync.balance);
            }

            return {
              ...purchaseResult,
              transactionId: realTransactionId,
              granted: sync.granted,
              pending: sync.pending,
              tokensGranted: sync.tokensGranted,
              balance: sync.balance,
            };
          } catch (syncError) {
            console.warn('[purchases] web syncConsumablePurchase failed', syncError);
            return {
              ...purchaseResult,
              transactionId: realTransactionId,
              granted: false,
              pending: true,
              tokensGranted: 0,
              balance: null,
            };
          }
        }

        // Native: Test Store grants may omit a transaction id; use a
        // deterministic fallback so client-side grant still works.
        const transactionId =
          purchaseResult.transactionId?.trim() ||
          `rc:${purchaseResult.store}:${session.appUserId}:${product.identifier}:${Date.now()}`;

        try {
          const sync = await syncConsumablePurchase({
            purchaserAccountId: session.appUserId,
            productId: product.identifier,
            transactionId,
            store: purchaseResult.store,
          });

          if (sync.balance != null) {
            setTokenBalance(sync.balance);
          }

          return {
            ...purchaseResult,
            transactionId,
            granted: sync.granted,
            pending: sync.pending,
            tokensGranted: sync.tokensGranted,
            balance: sync.balance,
          };
        } catch (syncError) {
          // Purchase succeeded in RC; wallet grant failed (e.g. webhook-only store).
          console.warn('[purchases] syncConsumablePurchase failed', syncError);
          return {
            ...purchaseResult,
            transactionId,
            granted: false,
            pending: true,
            tokensGranted: 0,
            balance: null,
          };
        }
      } catch (cause: unknown) {
        if (isPurchaseCancelledError(cause) || isWebPurchaseCancelledError(cause)) {
          throw new Error('Purchase cancelled.');
        }
        throw cause instanceof Error ? cause : new Error('Purchase failed. Please try again.');
      } finally {
        setIsPurchasing(false);
      }
    },
    [
      enabled,
      products,
      session.appUserId,
      session.ready,
      setTokenBalance,
      syncConsumablePurchase,
    ]
  );

  const combinedError = error ?? session.error;

  return {
    purchaserAccountId: session.appUserId,
    products,
    isReady: isReady && session.ready,
    isPurchasing,
    isSupported: isRevenueCatSupported(),
    error: combinedError,
    purchase,
  };
}
