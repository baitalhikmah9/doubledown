import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, I18nManager } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

export type AdminScreenHeaderProps = {
  title: string;
  description?: string;
  fallbackHref?: Href;
  showBack?: boolean;
  backAccessibilityLabel?: string;
  headerRight?: ReactNode;
};

export function AdminScreenHeader({
  title,
  description,
  fallbackHref,
  showBack,
  backAccessibilityLabel = 'Go back',
  headerRight,
}: AdminScreenHeaderProps) {
  const router = useRouter();
  const chevronName = I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';
  const shouldShowBack = showBack ?? Boolean(fallbackHref);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  };

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        {shouldShowBack && (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
          >
            <Ionicons name={chevronName} size={16} color={ADMIN_THEME.colors.foreground} />
          </Pressable>
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </View>
      {headerRight ? <View style={styles.headerTrailing}>{headerRight}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 40,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ADMIN_THEME.radius.md,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    backgroundColor: ADMIN_THEME.colors.card,
  },
  backPressed: {
    backgroundColor: ADMIN_THEME.colors.secondary,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.displayBold,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: ADMIN_THEME.colors.foreground,
  },
  description: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  headerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
