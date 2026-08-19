import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

function formatMoney(micros: number, currencyCode: string) {
  return `${(micros / 1_000_000).toFixed(2)} ${currencyCode}`;
}

function formatDeadline(epoch: number | null): string {
  if (epoch === null) return 'No deadline';
  return new Date(epoch).toLocaleDateString();
}

export default function AffiliateDashboardScreen() {
  const dashboard = useQuery(api.affiliate.getMyDashboard, {});

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="My coupon"
        description="Your assigned code, uses, and earnings"
      />

      {dashboard === undefined ? (
        <Text style={styles.muted}>Loading your coupon...</Text>
      ) : dashboard.codes.length === 0 ? (
        <Text style={styles.muted}>No affiliate code is assigned to this account.</Text>
      ) : (
        dashboard.codes.map((item) => (
          <AdminCard key={item.code}>
            <AdminCardTitle>{item.code.toUpperCase()}</AdminCardTitle>
            <View style={styles.grid}>
              <Stat label="Times used" value={String(item.usageCount)} />
              <Stat label="Commission" value={`${item.commissionPercent}%`} />
              {item.rewardType === 'discount' && item.discountPercent !== null ? (
                <Stat
                  label="Discount"
                  value={`${item.discountPercent}% off ${item.productKey ?? 'bundle'}`}
                />
              ) : (
                <Stat label="Type" value="Free tokens" />
              )}
              <Stat label="Auto-deadline" value={formatDeadline(item.activeTo)} />
            </View>
            {item.earningsByCurrency.length === 0 ? (
              <Text style={styles.muted}>No attributed sales yet.</Text>
            ) : (
              item.earningsByCurrency.map((row) => (
                <View key={row.currencyCode} style={styles.currencyBlock}>
                  <Text style={styles.currencyTitle}>{row.currencyCode}</Text>
                  <View style={styles.grid}>
                    <Stat
                      label="Total sales"
                      value={formatMoney(row.totalSaleMicros, row.currencyCode)}
                    />
                    <Stat
                      label="Average sale"
                      value={formatMoney(row.averageSaleMicros, row.currencyCode)}
                    />
                    <Stat
                      label="Average commission"
                      value={formatMoney(row.averageCommissionMicros, row.currencyCode)}
                    />
                    <Stat
                      label="Total earnings"
                      value={formatMoney(row.totalCommissionMicros, row.currencyCode)}
                    />
                  </View>
                </View>
              ))
            )}
          </AdminCard>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    gap: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  stat: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 140,
    gap: 4,
  },
  statLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  statValue: {
    fontFamily: FONTS.ui,
    fontSize: 18,
    color: ADMIN_THEME.colors.foreground,
  },
  currencyBlock: {
    gap: 12,
    paddingTop: 8,
  },
  currencyTitle: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
  },
  muted: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.mutedForeground,
  },
});
