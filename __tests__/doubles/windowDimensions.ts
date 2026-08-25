/**
 * Controllable window dimensions for screen tests.
 *
 * react-native's public `useWindowDimensions` reads `Dimensions.get('window')`
 * via a relative require, so Jest moduleNameMapper cannot swap that implementation.
 * Mutating Dimensions keeps both the deep import path and RN's re-export in sync.
 */
import { Dimensions } from 'react-native';

const DEFAULT = {
  width: 800,
  height: 700,
  scale: 2,
  fontScale: 1,
};

let dimensions = { ...DEFAULT };

function applyDimensions(next: typeof dimensions): void {
  dimensions = next;
  Dimensions.set({
    window: next,
    screen: next,
  });
}

applyDimensions({ ...DEFAULT });

export default function useWindowDimensions() {
  return dimensions;
}

export function __setWindowDimensions(next: Partial<typeof dimensions>): void {
  applyDimensions({ ...dimensions, ...next });
}

export function __resetWindowDimensionsDouble(): void {
  applyDimensions({ ...DEFAULT });
}
