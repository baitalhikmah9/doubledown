import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

export function AdminCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AdminCardHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function AdminCardTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function AdminCardDescription({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}

export function AdminCardContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.content, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ADMIN_THEME.colors.card,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.xl,
    padding: 20,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: ADMIN_THEME.colors.foreground,
  },
  description: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  content: {
    minWidth: 0,
  },
});
