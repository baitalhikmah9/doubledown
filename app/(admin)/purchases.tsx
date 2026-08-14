import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import PromoModeDropdown from '@/components/admin/PromoModeDropdown';
import { BRAND_ADMIN_TABLE, BRAND_RAISED_SURFACE, COLORS, FONTS, SPACING } from '@/constants/theme';
import { Link } from 'expo-router';
import { HOME_SOFT_UI } from '@/themes';

const SOFT = HOME_SOFT_UI.colors;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'granted', label: 'Granted' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STORE_OPTIONS = [
  { value: '', label: 'All Stores' },
  { value: 'app_store', label: 'App Store' },
  { value: 'play_store', label: 'Google Play' },
];

export default function PurchasesScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const [status, setStatus] = useState('');
  const [store, setStore] = useState('');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [cursorStack, setCursorStack] = useState<number[]>([]);

  const cursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;

  const purchases = useQuery(api.admin.listPurchases, {
    status: status || undefined,
    store: store || undefined,
    purchaserQuery: submittedSearch || undefined,
    cursor,
    limit: 50,
  });

  const resetPagination = () => setCursorStack([]);

  const handleSearch = () => {
    setSubmittedSearch(search.trim());
    resetPagination();
  };

  const setStatusAndReset = (value: string) => {
    setStatus(value);
    resetPagination();
  };

  const setStoreAndReset = (value: string) => {
    setStore(value);
    resetPagination();
  };

  const handleNext = () => {
    if (purchases?.nextCursor != null) {
      setCursorStack([...cursorStack, purchases.nextCursor]);
    }
  };

  const handlePrevious = () => setCursorStack(cursorStack.slice(0, -1));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Purchases"
        fallbackHref="/admin"
        backAccessibilityLabel="Back to admin overview"
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Filters</Text>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="Purchaser ID or store transaction ID"
            placeholderTextColor={COLORS.disabled}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleSearch}
          >
            <Text style={styles.primaryButtonText}>Search</Text>
          </Pressable>
        </View>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>Status</Text>
            <PromoModeDropdown value={status} options={STATUS_OPTIONS} onValueChange={setStatusAndReset} />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>Store</Text>
            <PromoModeDropdown value={store} options={STORE_OPTIONS} onValueChange={setStoreAndReset} />
          </View>
        </View>
      </View>

      {purchases === undefined ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : (
        <>
          {purchases.items.length === 0 ? (
            <Text style={styles.empty}>No purchases found.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell, styles.cellStore]}>Store</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellProduct]}>Product</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellStatus]}>Status</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellTx]}>Store Tx ID</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellDate]}>Date</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellActions]} />
              </View>
              {purchases.items.map((purchase: any) => (
                <Link key={purchase._id} href={`/admin/purchases/${purchase._id}`} asChild>
                  <Pressable style={styles.row}>
                    <Text style={[styles.cell, styles.cellStore]} numberOfLines={1}>
                      {formatStore(purchase.store)}
                    </Text>
                    <Text style={[styles.cell, styles.cellProduct]} numberOfLines={1}>
                      {purchase.productKey}
                    </Text>
                    <Text style={[styles.cell, styles.cellStatus]}>{purchase.status}</Text>
                    <Text style={[styles.cell, styles.cellTx]} numberOfLines={1} selectable>
                      {purchase.storeTransactionId}
                    </Text>
                    <Text style={[styles.cell, styles.cellDate]}>
                      {new Date(purchase.purchasedAt).toLocaleDateString()}
                    </Text>
                    <View style={styles.cellActions}>
                      <Text style={styles.link}>View</Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
          {(cursorStack.length > 0 || purchases.nextCursor != null) && (
            <View style={styles.paginationRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || cursorStack.length === 0) && styles.disabledButton,
                ]}
                onPress={handlePrevious}
                disabled={cursorStack.length === 0}
              >
                <Text style={styles.secondaryButtonText}>Previous</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || purchases.nextCursor == null) && styles.disabledButton,
                ]}
                onPress={handleNext}
                disabled={purchases.nextCursor == null}
              >
                <Text style={styles.secondaryButtonText}>Next</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function formatStore(store?: string | null) {
  if (store === 'app_store') return 'App Store';
  if (store === 'play_store') return 'Google Play';
  return store ?? '-';
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    gap: SPACING.lg,
  },
  panel: {
    ...BRAND_RAISED_SURFACE,
    borderRadius: 18,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  panelTitle: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 16,
    color: SOFT.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  filterRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterField: {
    flex: 1,
    minWidth: 180,
  },
  formLabel: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 12,
    color: SOFT.textMuted,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND_ADMIN_TABLE.inputBorder,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: SOFT.textPrimary,
    backgroundColor: BRAND_ADMIN_TABLE.inputBackground,
  },
  primaryButton: {
    ...BRAND_RAISED_SURFACE,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: SOFT.textPrimary,
  },
  empty: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: SOFT.textMuted,
    paddingVertical: SPACING.md,
  },
  table: {
    gap: 1,
    backgroundColor: BRAND_ADMIN_TABLE.rowDivider,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: BRAND_ADMIN_TABLE.headerBackground,
  },
  cell: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: SOFT.textPrimary,
  },
  headerCell: {
    fontFamily: FONTS.uiSemibold,
    color: SOFT.textMuted,
    fontSize: 12,
  },
  cellStore: {
    flex: 1,
    minWidth: 0,
  },
  cellProduct: {
    flex: 2,
    minWidth: 0,
  },
  cellStatus: {
    flex: 1,
  },
  cellTx: {
    flex: 2,
    minWidth: 0,
  },
  cellDate: {
    flex: 1,
  },
  cellActions: {
    flex: 1,
    alignItems: 'flex-end',
  },
  link: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 13,
    color: COLORS.primary,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  secondaryButton: {
    ...BRAND_RAISED_SURFACE,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: SOFT.textPrimary,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
