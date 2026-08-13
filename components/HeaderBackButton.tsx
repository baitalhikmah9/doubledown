import { Platform, type FlexStyle, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '@/components/ui/Pressable';
import { SPACING, BORDER_RADIUS, FONTS, SOFT_SURFACE_FACE, softSurfaceLift } from '@/constants';
import { HOME_SOFT_UI } from '@/themes';
import { useDarkModeFlatTop } from '@/lib/hooks/useTheme';
import { getWebViewportScale } from '@/lib/layout/webViewportScale';

const T = HOME_SOFT_UI.colors;

export type HeaderBackButtonVariant = 'labeled' | 'icon';

export type HeaderBackButtonProps = {
  onPress: () => void;
  direction: string;
  rowDirection: FlexStyle['flexDirection'];
  label: string;
  accessibilityLabel?: string;
  /**
   * - `labeled` - play-stack control (chevron + "Back" text)
   * - `icon` - settings/store raised 44×44 squircle (chevron only)
   */
  variant?: HeaderBackButtonVariant;
};

const BACK_PILL_SHADOW = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

/**
 * Shared back control for GameHeader `leftSlot`.
 *
 * Default is the labeled play-stack control. Use `variant="icon"` for the
 * settings/store raised squircle (docs/BRAND_GUIDELINES.md header back).
 */
export function HeaderBackButton({
  onPress,
  direction,
  rowDirection,
  label,
  accessibilityLabel,
  variant = 'labeled',
}: HeaderBackButtonProps) {
  const darkModeFlatTop = useDarkModeFlatTop();
  const { width, height } = useWindowDimensions();
  const scale = Platform.OS === 'web' ? getWebViewportScale(width, height) : 1;
  const backIcon: keyof typeof Ionicons.glyphMap =
    direction === 'rtl' ? 'chevron-forward' : 'chevron-back';
  const a11y = accessibilityLabel ?? label;

  if (variant === 'icon') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.backIconSquircle,
          SOFT_SURFACE_FACE,
          darkModeFlatTop,
          softSurfaceLift(),
          {
            width: Math.round(44 * scale),
            height: Math.round(44 * scale),
            borderRadius: Math.round(14 * scale),
            backgroundColor: T.surface,
          },
          {
            opacity: pressed ? 0.9 : 1,
            transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        <Ionicons name={backIcon} size={Math.round(22 * scale)} color={T.textPrimary} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.backPill,
        darkModeFlatTop,
        BACK_PILL_SHADOW,
        {
          minWidth: Math.round(96 * scale),
          gap: Math.round(SPACING.xs * scale),
          paddingVertical: Math.round(SPACING.sm * scale),
          paddingHorizontal: Math.round(SPACING.md * scale),
          borderRadius: Math.round(BORDER_RADIUS.button * scale),
          backgroundColor: T.surface,
          flexDirection: rowDirection,
        },
        { opacity: pressed ? 0.92 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Ionicons name={backIcon} size={Math.round(20 * scale)} color={T.textPrimary} />
      <Text
        style={[
          styles.backLabel,
          { color: T.textPrimary, fontSize: Math.round(14 * scale) },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minWidth: 96,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.button,
    borderWidth: 0,
    backgroundColor: T.surface,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  backLabel: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 14,
    color: T.textPrimary,
  },
});
