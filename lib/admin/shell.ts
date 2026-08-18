import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export const ADMIN_SIDEBAR_COLLAPSED_KEY = 'backfire:admin-sidebar-collapsed';

export function useSidebarCollapsed(): [boolean, (next: boolean) => void, () => void] {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      if (globalThis.localStorage?.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === '1') {
        setCollapsedState(true);
      }
    } catch {
      // Storage can throw in private mode.
    }
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    if (Platform.OS !== 'web') return;
    try {
      globalThis.localStorage?.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Ignore write failures.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((current) => {
      const next = !current;
      if (Platform.OS === 'web') {
        try {
          globalThis.localStorage?.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
        } catch {
          // Ignore write failures.
        }
      }
      return next;
    });
  }, []);

  return [collapsed, setCollapsed, toggle];
}

const ROUTE_LABELS: Record<string, string> = {
  admin: 'Dashboard',
  transactions: 'Transactions',
  purchases: 'Purchases',
  'promo-codes': 'Promo Codes',
  wallets: 'Wallets',
  audit: 'Audit Log',
  affiliate: 'My coupon',
  'sign-out': 'Sign out',
};

export function normalizeAdminPath(pathname: string): string {
  const path = pathname.replace('/(admin)', '/admin');
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

export type AdminBreadcrumb = { label: string; href?: string };

export function breadcrumbsForAdminPath(
  pathname: string,
  options?: { affiliate?: boolean }
): AdminBreadcrumb[] {
  if (options?.affiliate) {
    return [{ label: 'My coupon' }];
  }

  const path = normalizeAdminPath(pathname);
  if (path === '/admin' || path === '') {
    return [{ label: 'Dashboard' }];
  }

  const parts = path.split('/').filter(Boolean);
  const crumbs: AdminBreadcrumb[] = [];
  let acc = '';
  parts.forEach((part, index) => {
    acc += `/${part}`;
    const last = index === parts.length - 1;
    crumbs.push({
      label: ROUTE_LABELS[part] ?? 'Details',
      href: last ? undefined : acc,
    });
  });
  return crumbs;
}
