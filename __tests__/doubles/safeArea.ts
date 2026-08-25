/** Test double for `react-native-safe-area-context`. */
import React from 'react';
import { View, type ViewProps } from 'react-native';

let insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function SafeAreaView({ children, ...props }: ViewProps & { children?: React.ReactNode }) {
  return React.createElement(View, props, children);
}

export function SafeAreaProvider({ children }: { children?: React.ReactNode }) {
  return React.createElement(View, null, children);
}

export function useSafeAreaInsets() {
  return insets;
}

export function __setSafeAreaInsets(next: typeof insets): void {
  insets = next;
}

export function __resetSafeAreaDouble(): void {
  insets = { top: 0, right: 0, bottom: 0, left: 0 };
}
