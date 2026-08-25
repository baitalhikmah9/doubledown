import { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FONTS } from '@/constants/theme';
import { HOME_SOFT_UI } from '@/themes';

type MediaQueryListLike = {
  matches: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

/**
 * Mobile-web signal: primary coarse pointer and/or no-hover touch profile.
 * Not user-agent based. Desktop (fine pointer + hover) stays false even when
 * the window is tall/narrow. SSR has no pointer API; returns false so static
 * desktop HTML is not gated (mobile hydrates and re-evaluates).
 */
export function isMobileWebClient(): boolean {
  if (typeof window === 'undefined') {
    // SSR fallback: no matchMedia/touch. Do not gate until client evaluation.
    return false;
  }

  try {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(pointer: coarse)').matches) return true;
      // Phones/tablets typically lack hover and are not fine-pointer primary.
      if (
        window.matchMedia('(hover: none)').matches &&
        !window.matchMedia('(pointer: fine)').matches
      ) {
        return true;
      }
      // matchMedia available and not mobile.
      return false;
    }
  } catch {
    /* matchMedia can throw in odd test hosts; fall through to touch */
  }

  // Conservative touch fallback when matchMedia is missing (including some SSR-adjacent hosts).
  return (window.navigator?.maxTouchPoints ?? 0) > 0;
}

function subscribeMobileWeb(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const queries = ['(pointer: coarse)', '(pointer: fine)', '(hover: none)'];
  const lists: MediaQueryListLike[] = [];

  for (const query of queries) {
    try {
      lists.push(window.matchMedia(query));
    } catch {
      /* skip broken query */
    }
  }

  for (const list of lists) {
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onStoreChange);
    } else if (typeof list.addListener === 'function') {
      list.addListener(onStoreChange);
    }
  }

  return () => {
    for (const list of lists) {
      if (typeof list.removeEventListener === 'function') {
        list.removeEventListener('change', onStoreChange);
      } else if (typeof list.removeListener === 'function') {
        list.removeListener(onStoreChange);
      }
    }
  };
}

function useIsMobileWebClient(): boolean {
  return useSyncExternalStore(subscribeMobileWeb, isMobileWebClient, () => false);
}

/**
 * Full-screen rotate gate for mobile web in portrait.
 * Native is unchanged. Desktop web stays usable in portrait.
 * Mobile Safari cannot lock orientation; this blocks interaction until rotation.
 */
export function WebLandscapeGate() {
  if (Platform.OS !== 'web') return null;
  return <WebLandscapeGateInner />;
}

function WebLandscapeGateInner() {
  const { width, height } = useWindowDimensions();
  const mobileWeb = useIsMobileWebClient();
  const portrait = height > width;

  if (!mobileWeb || !portrait) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="auto"
      style={styles.overlay}
    >
      <Text style={styles.title}>Rotate your device</Text>
      <Text style={styles.body}>Backfire plays in landscape only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: HOME_SOFT_UI.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: FONTS.displayBold,
    fontSize: 28,
    color: HOME_SOFT_UI.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: FONTS.ui,
    fontSize: 16,
    color: HOME_SOFT_UI.colors.textMuted,
    textAlign: 'center',
  },
});
