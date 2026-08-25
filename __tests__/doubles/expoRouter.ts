/**
 * Controllable expo-router double for component/screen tests.
 * Wired via jest moduleNameMapper so production imports resolve here under Jest.
 */
import React from 'react';
import { View } from 'react-native';

type RouteParams = Record<string, string | string[] | undefined>;

const push = jest.fn();
const replace = jest.fn();
const back = jest.fn();
const canGoBack = jest.fn(() => false);
const navigate = jest.fn();
const setParams = jest.fn();
const dismiss = jest.fn();
const dismissAll = jest.fn();
const dismissTo = jest.fn();

let pathName = '/';
let segments: string[] = [];
let params: RouteParams = {};

export const router = {
  push,
  replace,
  back,
  canGoBack,
  navigate,
  setParams,
  dismiss,
  dismissAll,
  dismissTo,
};

export function useRouter() {
  return router;
}

export function usePathname() {
  return pathName;
}

export function useSegments() {
  return segments;
}

export function useLocalSearchParams<T extends RouteParams = RouteParams>(): T {
  // SAFETY: Test double returns the mutable params bag tests configure per case.
  return params as T;
}

export function useGlobalSearchParams<T extends RouteParams = RouteParams>(): T {
  // SAFETY: Test double returns the mutable params bag tests configure per case.
  return params as T;
}

export function Link({
  children,
  ...props
}: {
  children?: React.ReactNode;
  href?: string;
  asChild?: boolean;
}) {
  return React.createElement(View, { accessibilityRole: 'link', ...props }, children);
}

export function Redirect(_props: { href: string }) {
  return null;
}

export function Stack({ children }: { children?: React.ReactNode }) {
  return React.createElement(View, null, children);
}
Stack.Screen = function StackScreen() {
  return null;
};

export function Tabs({ children }: { children?: React.ReactNode }) {
  return React.createElement(View, null, children);
}
Tabs.Screen = function TabsScreen() {
  return null;
};

export function Slot() {
  return null;
}

export type Href = string;

export function __setPathname(next: string): void {
  pathName = next;
}

export function __setSegments(next: string[]): void {
  segments = next;
}

export function __setParams(next: RouteParams): void {
  params = next;
}

export function __resetExpoRouterDouble(): void {
  push.mockClear();
  replace.mockClear();
  back.mockClear();
  canGoBack.mockClear();
  canGoBack.mockReturnValue(false);
  navigate.mockClear();
  setParams.mockClear();
  dismiss.mockClear();
  dismissAll.mockClear();
  dismissTo.mockClear();
  pathName = '/';
  segments = [];
  params = {};
}
