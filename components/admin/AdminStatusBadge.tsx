import { View, Text, StyleSheet } from 'react-native';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

type StatusStyle = {
  bg: string;
  border: string;
  text: string;
};

export function getStatusStyle(status: string): StatusStyle {
  const s = ADMIN_THEME.colors.status;
  switch (status.toLowerCase()) {
    case 'active':
    case 'granted':
    case 'posted':
    case 'success':
      return { bg: s.successBg, border: s.successBorder, text: s.success };
    case 'inactive':
    case 'expired':
    case 'reversed':
    case 'cancelled':
    case 'failed':
      return { bg: s.errorBg, border: s.errorBorder, text: s.error };
    case 'scheduled':
    case 'pending':
      return { bg: s.infoBg, border: s.infoBorder, text: s.info };
    case 'exhausted':
    case 'warning':
      return { bg: s.warningBg, border: s.warningBorder, text: s.warning };
    default:
      return { bg: s.neutralBg, border: s.neutralBorder, text: s.neutral };
  }
}

export function statusColor(status: string): string {
  return getStatusStyle(status).text;
}

export function AdminStatusBadge({
  label,
  color,
  status,
}: {
  label: string;
  color?: string;
  status?: string;
}) {
  const resolved = getStatusStyle(status ?? label);
  const textColor = color ?? resolved.text;
  const bgColor = resolved.bg;
  const borderColor = resolved.border;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
  },
});
