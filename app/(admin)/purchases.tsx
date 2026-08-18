import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminButton } from '@/components/admin/AdminButton';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import PromoModeDropdown from '@/components/admin/PromoModeDropdown';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

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

type PurchaseRow = {
  _id: string;
  store?: string | null;
  productKey: string;
  status: string;
  storeTransactionId: string;
  purchasedAt: number;
};

function formatStore(store?: string | null) {
  if (store === 'app_store') return 'App Store';
  if (store === 'play_store') return 'Google Play';
  return store ?? '-';
}

export default function PurchasesScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const router = useRouter();

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

  const columns: AdminTableColumn<PurchaseRow>[] = [
    {
      key: 'store',
      label: 'Store',
      flex: 1,
      render: (row) => formatStore(row.store),
    },
    { key: 'product', label: 'Product', flex: 2, render: (row) => row.productKey },
    {
      key: 'status',
      label: 'Status',
      flex: 1,
      render: (row) => <AdminStatusBadge label={row.status} status={row.status} />,
    },
    {
      key: 'tx',
      label: 'Store Tx ID',
      flex: 2,
      render: (row) => row.storeTransactionId,
    },
    {
      key: 'date',
      label: 'Date',
      flex: 1,
      render: (row) => new Date(row.purchasedAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      flex: 1,
      align: 'right',
      render: (row) => <Text style={styles.link}>View</Text>,
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Purchases"
        description="View IAP and store transactions"
      />

      <AdminCard>
        <AdminCardTitle>Filters</AdminCardTitle>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.input}
            placeholder="Purchaser ID or store transaction ID..."
            placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
          <AdminButton label="Search" onPress={handleSearch} />
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
      </AdminCard>

      {purchases === undefined ? (
        <Text style={styles.loadingText}>Loading purchases...</Text>
      ) : (
        <>
          <AdminTable
            columns={columns}
            rows={purchases.items as PurchaseRow[]}
            rowKey={(row) => row._id}
            onRowPress={(row) => router.push(`/admin/purchases/${row._id}`)}
            emptyText="No purchases found."
          />
          {(cursorStack.length > 0 || purchases.nextCursor != null) && (
            <AdminPagination
              hasPrevious={cursorStack.length > 0}
              hasNext={purchases.nextCursor != null}
              onPrevious={handlePrevious}
              onNext={handleNext}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    gap: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  filterRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterField: {
    flex: 1,
    minWidth: 160,
  },
  formLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.md,
    paddingHorizontal: 12,
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    backgroundColor: ADMIN_THEME.colors.inputBackground,
  },
  loadingText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
    paddingVertical: 20,
  },
  link: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    textDecorationLine: 'underline',
  },
});
