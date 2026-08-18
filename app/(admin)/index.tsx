import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { AdminCard, AdminCardHeader, AdminCardTitle, AdminCardDescription, AdminCardContent } from '@/components/admin/AdminCard';
import { adminHref } from '@/lib/admin/shell';

const STAT_COL_BREAKPOINT = 640;
const DESKTOP_BREAKPOINT = 1024;

type MonthlyPoint = { label: string; total: number };

type RecentTransaction = {
  id: string;
  account: string | null;
  type: string;
  amount: number;
  createdAt: number;
  walletId: string;
  purchaseId: string | null;
};

type DashboardStats = {
  currencyCode: string;
  totalRevenue: number;
  revenueDeltaPct: number | null;
  purchasesTotal: number;
  purchasesDeltaPct: number | null;
  activePromoCodes: number;
  totalPromoCodes: number;
  totalRedemptions: number;
  monthlyRevenue: MonthlyPoint[];
  recentTransactions: RecentTransaction[];
};

function formatCurrency(micros: number, currency: string): string {
  const value = micros / 1_000_000;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function deltaLabel(
  pct: number | null | undefined,
  current: number,
  kind: 'revenue' | 'purchases'
): string {
  if (pct != null) {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}% from last month`;
  }
  if (current > 0) return 'New this month';
  return kind === 'revenue' ? 'No revenue recorded yet' : 'No purchases recorded yet';
}

function getNiceCeiling(val: number): number {
  if (val <= 0) return 100;
  if (val <= 10) return 10;
  if (val <= 50) return 50;
  if (val <= 100) return 100;
  if (val <= 500) return 500;
  if (val <= 1000) return 1000;
  if (val <= 5000) return 5000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / magnitude) * magnitude;
}

// ── Stat Card (shadcn-admin metric card) ─────────────────────────────
function StatCard({
  title,
  value,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCardPressable,
        pressed && styles.statCardPressed,
      ]}
    >
      <AdminCard style={styles.statCard}>
        <View style={styles.statHeader}>
          <Text style={styles.statTitle}>{title}</Text>
          <View style={styles.statIconWrap}>{icon}</View>
        </View>
        <View style={styles.statBody}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statSubtitle}>{subtitle}</Text>
        </View>
      </AdminCard>
    </Pressable>
  );
}

// ── Tabs List ────────────────────────────────────────────────────────
const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', disabled: false },
  { id: 'analytics', label: 'Analytics', disabled: false },
];

function DashboardTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}) {
  return (
    <View style={styles.tabsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsList}
      >
        {DASHBOARD_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              disabled={tab.disabled}
              onPress={() => onSelectTab(tab.id)}
              style={({ pressed }) => [
                styles.tabTrigger,
                isActive && styles.tabTriggerActive,
                tab.disabled && styles.tabTriggerDisabled,
                pressed && !tab.disabled && styles.tabTriggerPressed,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                  tab.disabled && styles.tabTextDisabled,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Overview Bar Chart with Real Monthly Data ────────────────────────
function OverviewBarChart({ data }: { data: MonthlyPoint[] }) {
  const maxDollarRaw = Math.max(...data.map((d) => d.total / 1_000_000), 0);
  const maxVal = getNiceCeiling(maxDollarRaw);
  const yAxisTicks = [
    `$${maxVal}`,
    `$${Math.round(maxVal * 0.75)}`,
    `$${Math.round(maxVal * 0.5)}`,
    `$${Math.round(maxVal * 0.25)}`,
    '$0',
  ];

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartMainArea}>
        {/* Y Axis ticks */}
        <View style={styles.yAxisColumn}>
          {yAxisTicks.map((tick, idx) => (
            <Text key={idx} style={styles.yAxisLabel}>
              {tick}
            </Text>
          ))}
        </View>

        {/* Chart columns area */}
        <View style={styles.barsArea}>
          {data.map((item) => {
            const dollarVal = item.total / 1_000_000;
            const heightPct =
              maxVal > 0 && dollarVal > 0
                ? Math.min(Math.max((dollarVal / maxVal) * 100, 2), 100)
                : 0;
            return (
              <View key={item.label} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  {heightPct > 0 ? (
                    <View style={[styles.barFill, { height: `${heightPct}%` }]} />
                  ) : (
                    <View style={styles.barEmptyLine} />
                  )}
                </View>
                <Text style={styles.xAxisLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Recent Activity List with Real Transaction Records ───────────────
function RecentActivityList({
  transactions,
  onPressItem,
}: {
  transactions: RecentTransaction[];
  onPressItem: (tx: RecentTransaction) => void;
}) {
  if (!transactions || transactions.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No recent transactions recorded.</Text>
      </View>
    );
  }

  return (
    <View style={styles.recentSalesList}>
      {transactions.slice(0, 5).map((tx) => {
        const initial = tx.account ? tx.account.trim().charAt(0).toUpperCase() : 'W';
        const sign = tx.amount > 0 ? '+' : '';
        const date = new Date(tx.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const typeLabel = tx.type.replace(/_/g, ' ');
        return (
          <Pressable
            key={tx.id}
            accessibilityRole="button"
            accessibilityLabel={`Transaction ${tx.type} for ${tx.account ?? 'account'}`}
            onPress={() => onPressItem(tx)}
            style={({ pressed }) => [
              styles.recentSaleItem,
              pressed && styles.recentSaleItemPressed,
            ]}
          >
            <View style={styles.saleAvatar}>
              <Text style={styles.saleAvatarText}>{initial}</Text>
            </View>
            <View style={styles.saleInfo}>
              <Text style={styles.saleName} numberOfLines={1}>
                {tx.account ?? 'Unknown account'}
              </Text>
              <Text style={styles.saleEmail} numberOfLines={1}>
                {typeLabel} · {date}
              </Text>
            </View>
            <Text style={styles.saleAmount}>
              {sign}
              {formatCount(tx.amount)} tokens
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main Dashboard Screen ────────────────────────────────────────────
export default function AdminIndexScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const stats = useQuery(api.admin.getDashboardStats, {}) as DashboardStats | undefined;

  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isTablet = width >= STAT_COL_BREAKPOINT;
  const cardWidth = isDesktop ? '23.8%' : isTablet ? '48.5%' : '100%';

  const totalRev = formatCurrency(stats?.totalRevenue ?? 0, stats?.currencyCode ?? 'USD');
  const revDelta = deltaLabel(stats?.revenueDeltaPct, stats?.totalRevenue ?? 0, 'revenue');

  const purchasesCount = formatCount(stats?.purchasesTotal ?? 0);
  const purchasesDelta = deltaLabel(stats?.purchasesDeltaPct, stats?.purchasesTotal ?? 0, 'purchases');

  const activePromoCount = formatCount(stats?.activePromoCodes ?? 0);
  const totalPromoCount = formatCount(stats?.totalPromoCodes ?? 0);

  const redemptionsCount = formatCount(stats?.totalRedemptions ?? 0);

  const handleTransactionPress = (tx: RecentTransaction) => {
    if (tx.purchaseId) {
      router.push(adminHref(`/admin/purchases/${tx.purchaseId}`) as any);
    } else if (tx.walletId) {
      router.push(adminHref(`/admin/wallets/${tx.walletId}`) as any);
    } else {
      router.push(adminHref('/admin/transactions') as any);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Top Header Row ───────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Dashboard</Text>
      </View>

      {/* ── Tabs List ────────────────────────────────── */}
      <DashboardTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* ── 4 Stat Cards Grid ────────────────────────── */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCardWrapper, { width: cardWidth }]}>
          <StatCard
            title="Total Revenue"
            value={totalRev}
            subtitle={revDelta}
            icon={<Text style={styles.dollarIcon}>$</Text>}
            onPress={() => router.push(adminHref('/admin/purchases') as any)}
          />
        </View>
        <View style={[styles.statCardWrapper, { width: cardWidth }]}>
          <StatCard
            title="Purchases"
            value={`+${purchasesCount}`}
            subtitle={purchasesDelta}
            icon={<Ionicons name="cart-outline" size={16} color={ADMIN_THEME.colors.mutedForeground} />}
            onPress={() => router.push(adminHref('/admin/purchases') as any)}
          />
        </View>
        <View style={[styles.statCardWrapper, { width: cardWidth }]}>
          <StatCard
            title="Active Promo Codes"
            value={activePromoCount}
            subtitle={`${activePromoCount} of ${totalPromoCount} total codes`}
            icon={<Ionicons name="pricetags-outline" size={16} color={ADMIN_THEME.colors.mutedForeground} />}
            onPress={() => router.push(adminHref('/admin/promo-codes') as any)}
          />
        </View>
        <View style={[styles.statCardWrapper, { width: cardWidth }]}>
          <StatCard
            title="Total Redemptions"
            value={redemptionsCount}
            subtitle={`across ${totalPromoCount} promo codes`}
            icon={<Ionicons name="pulse-outline" size={16} color={ADMIN_THEME.colors.mutedForeground} />}
            onPress={() => router.push(adminHref('/admin/promo-codes') as any)}
          />
        </View>
      </View>

      {/* ── Lower Section (Overview + Recent Activity) ── */}
      <View style={[styles.lowerGrid, isDesktop && styles.lowerGridDesktop]}>
        {/* Left Card: Overview Chart */}
        <AdminCard style={[styles.overviewCard, isDesktop && styles.overviewCardDesktop]}>
          <AdminCardHeader>
            <AdminCardTitle>Overview</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <OverviewBarChart data={stats?.monthlyRevenue ?? []} />
          </AdminCardContent>
        </AdminCard>

        {/* Right Card: Recent Transactions */}
        <AdminCard style={[styles.recentCard, isDesktop && styles.recentCardDesktop]}>
          <AdminCardHeader>
            <AdminCardTitle>Recent Activity</AdminCardTitle>
            <AdminCardDescription>
              {stats?.purchasesTotal
                ? `You made ${stats.purchasesTotal} purchases this period.`
                : 'Latest wallet & purchase activity'}
            </AdminCardDescription>
          </AdminCardHeader>
          <AdminCardContent>
            <RecentActivityList
              transactions={stats?.recentTransactions ?? []}
              onPressItem={handleTransactionPress}
            />
          </AdminCardContent>
        </AdminCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  container: {
    gap: 20,
    backgroundColor: ADMIN_THEME.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: ADMIN_THEME.colors.foreground,
  },

  // ── Tabs ──────────────────────────────────────────
  tabsContainer: {
    flexDirection: 'row',
  },
  tabsList: {
    flexDirection: 'row',
    backgroundColor: ADMIN_THEME.colors.secondary,
    padding: 3,
    borderRadius: ADMIN_THEME.radius.lg,
    gap: 2,
  },
  tabTrigger: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: ADMIN_THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTriggerActive: {
    backgroundColor: ADMIN_THEME.colors.card,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  tabTriggerDisabled: {
    opacity: 0.5,
  },
  tabTriggerPressed: {
    opacity: 0.8,
  },
  tabText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  tabTextActive: {
    color: ADMIN_THEME.colors.foreground,
    fontFamily: FONTS.uiSemibold,
  },
  tabTextDisabled: {
    color: ADMIN_THEME.colors.mutedForeground,
  },

  // ── Stat cards ────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  statCardWrapper: {
    minWidth: 0,
  },
  statCardPressable: {
    width: '100%',
  },
  statCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  statCard: {
    padding: 20,
    gap: 10,
    borderRadius: ADMIN_THEME.radius.xl,
    backgroundColor: ADMIN_THEME.colors.card,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statTitle: {
    fontFamily: FONTS.uiMedium,
    fontSize: 14,
    color: ADMIN_THEME.colors.foreground,
  },
  statIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dollarIcon: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 16,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  statBody: {
    gap: 4,
  },
  statValue: {
    fontFamily: FONTS.displayBold,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: ADMIN_THEME.colors.foreground,
  },
  statSubtitle: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },

  // ── Lower Section ─────────────────────────────────
  lowerGrid: {
    gap: 16,
  },
  lowerGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  overviewCard: {
    borderRadius: ADMIN_THEME.radius.xl,
    padding: 24,
    gap: 16,
  },
  overviewCardDesktop: {
    flex: 4,
  },
  recentCard: {
    borderRadius: ADMIN_THEME.radius.xl,
    padding: 24,
    gap: 16,
  },
  recentCardDesktop: {
    flex: 3,
  },

  // ── Bar Chart ─────────────────────────────────────
  chartContainer: {
    height: 320,
    justifyContent: 'flex-end',
    paddingTop: 12,
  },
  chartMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxisColumn: {
    width: 44,
    justifyContent: 'space-between',
    paddingBottom: 24,
    alignItems: 'flex-start',
  },
  yAxisLabel: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: '#888888',
  },
  barsArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    width: '75%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    backgroundColor: ADMIN_THEME.colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barEmptyLine: {
    width: '100%',
    height: 2,
    backgroundColor: ADMIN_THEME.colors.secondary,
    borderRadius: 1,
  },
  xAxisLabel: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: '#888888',
    height: 16,
  },

  // ── Recent Sales ──────────────────────────────────
  recentSalesList: {
    gap: 20,
    paddingTop: 4,
  },
  recentSaleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  recentSaleItemPressed: {
    opacity: 0.85,
  },
  saleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ADMIN_THEME.colors.secondary,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleAvatarText: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
  },
  saleInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  saleName: {
    fontFamily: FONTS.uiMedium,
    fontSize: 14,
    color: ADMIN_THEME.colors.foreground,
  },
  saleEmail: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  saleAmount: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 14,
    color: ADMIN_THEME.colors.foreground,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
  },
});
