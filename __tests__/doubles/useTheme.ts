/** Controllable `@/lib/hooks/useTheme` double. */
import { COLORS } from '@/constants/theme';

let theme = {
  colors: COLORS,
  isDark: false,
  // SAFETY: Controlled test boundary cast under fixture invariants.
  paletteId: 'default' as string,
};

export function useTheme() {
  return theme;
}

export function useDarkModeFlatTop() {
  return theme.isDark ? { elevation: 0, shadowOpacity: 0 } : null;
}

export function useThemePicker() {
  return {
    paletteId: theme.paletteId,
    setPaletteId: jest.fn(),
  };
}

export function useThemeHydration() {
  return undefined;
}

export function __setUseTheme(next: Partial<typeof theme>): void {
  theme = { ...theme, ...next, colors: next.colors ?? theme.colors };
}

export function __resetUseThemeDouble(): void {
  theme = {
    colors: COLORS,
    isDark: false,
    paletteId: 'default',
  };
}
