import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { usePathname } from 'expo-router';
import { FONTS } from '@/constants/theme';
import { HOME_SOFT_UI } from '@/themes';

/**
 * Landscape-only gate for web gameplay surfaces.
 * Web cannot hard-lock orientation outside fullscreen; on portrait play routes
 * we ask the user to rotate. Non-play routes (auth, admin, legal, home, etc.) stay usable.
 *
 * Covered surfaces:
 * - `/play/*` (and grouped `/(app)/play/*`)
 * - `/game` (and grouped `/(app)/game`): active create-game lobby/board
 *
 * Not covered: `/create-game`, auth, admin, legal, home, settings.
 */
export function isWebPlayLandscapePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Expo Router pathnames may include groups: "/(app)/play/board" or "/(app)/game".
  const normalized = pathname.replace(/\/\([^/]+\)/g, '');
  if (normalized === '/play' || normalized.startsWith('/play/')) return true;
  if (normalized === '/game' || normalized.startsWith('/game/')) return true;
  return false;
}

export function WebLandscapeGate() {
  if (Platform.OS !== 'web') return null;
  return <WebLandscapeGateInner />;
}

function WebLandscapeGateInner() {
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const [portrait, setPortrait] = useState(height > width);

  useEffect(() => {
    setPortrait(height > width);
  }, [height, width]);

  if (!isWebPlayLandscapePath(pathname) || !portrait) return null;

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
