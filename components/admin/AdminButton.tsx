import type { ComponentProps } from 'react';
import { Text, StyleSheet, Pressable, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

export type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function AdminButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  compact = false,
  icon,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: AdminButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors: Record<AdminButtonVariant, { bg: string; text: string; border: string }> = {
    primary: {
      bg: ADMIN_THEME.colors.primary,
      text: ADMIN_THEME.colors.primaryForeground,
      border: ADMIN_THEME.colors.primary,
    },
    secondary: {
      bg: ADMIN_THEME.colors.card,
      text: ADMIN_THEME.colors.foreground,
      border: ADMIN_THEME.colors.border,
    },
    ghost: {
      bg: 'transparent',
      text: ADMIN_THEME.colors.foreground,
      border: 'transparent',
    },
    danger: {
      bg: ADMIN_THEME.colors.destructive,
      text: ADMIN_THEME.colors.destructiveForeground,
      border: ADMIN_THEME.colors.destructive,
    },
  };
  const palette = colors[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 14 : 16} color={palette.text} /> : null}
      <Text style={[styles.label, compact && styles.labelCompact, { color: palette.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: ADMIN_THEME.radius.md,
  },
  regular: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 36,
  },
  compact: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    height: 32,
  },
  label: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  labelCompact: {
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
