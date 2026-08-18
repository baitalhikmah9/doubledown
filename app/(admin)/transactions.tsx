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
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminButton } from '@/components/admin/AdminButton';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { AdminPagination } from '@/components/admin/AdminPagination';
import PromoModeDropdown from '@/components/admin/PromoModeDropdown';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';
import { Link } from 'expo-router';
import {
  WALLET_TRANSACTION_SOURCES,
  WALLET_TRANSACTION_SOURCE_LABELS,
  WALLET_TRANSACTION_TYPES,
} from '@/convex/lib/walletTransactionTypes';

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  ...WALLET_TRANSACTION_SOURCES.map((source) => ({
    value: source,
    label: WALLET_TRANSACTION_SOURCE_LABELS[source],
  })),
];

type TransactionRow = {
  transaction: {
    _id: string;
    type: string;
    amount: number;
    source?: string | null;
    createdAt: number;
    purchaseId?: string | null;
  };
  wallet: { _id: string; purchaserAccountId?: string | null } | null;
  userEmail: string | null;
};

export default function TransactionsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [from, setFrom] = useState<number | undefined>(undefined);
  const [to, setTo] = useState<number | undefined>(undefined);
  const [dateError, setDateError] = useState('');
  const [cursorStack, setCursorStack] = useState<number[]>([]);

  const cursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;

  const transactions = useQuery(
    api.admin.listTransactions,
    {
      query: submittedSearch || undefined,
      type: (type || undefined) as any,
      source: (source || undefined) as any,
      from,
      to,
      cursor,
      limit: 50,
    }
  );

  const resetPagination = () => setCursorStack([]);

  const handleSearch = () => {
    setSubmittedSearch(search.trim());
    resetPagination();
  };

  const setTypeAndReset = (value: string) => {
    setType(value);
    resetPagination();
  };

  const setSourceAndReset = (value: string) => {
    setSource(value);
    resetPagination();
  };

  const handleApplyDates = () => {
    const parsedFrom = parseDateInput(dateFrom);
    const parsedTo = parseDateInput(dateTo);
    if (parsedFrom === 'invalid' || parsedTo === 'invalid') {
      setDateError('Dates must be valid YYYY-MM-DD values.');
      return;
    }
    if (parsedFrom !== undefined && parsedTo !== undefined && parsedFrom > parsedTo) {
      setDateError('From must be on or before To.');
      return;
    }
    setDateError('');
    setFrom(parsedFrom !== undefined ? startOfDay(parsedFrom) : undefined);
    setTo(parsedTo !== undefined ? exclusiveNextDay(parsedTo) : undefined);
    resetPagination();
  };

  const handleNext = () => {
    if (transactions?.nextCursor != null) {
      setCursorStack([...cursorStack, transactions.nextCursor]);
    }
  };

  const handlePrevious = () => setCursorStack(cursorStack.slice(0, -1));

  const columns: AdminTableColumn<TransactionRow>[] = [
    {
      key: 'account',
      label: 'Account',
      flex: 2,
      render: (item) => item.userEmail ?? item.wallet?.purchaserAccountId ?? '-',
    },
    { key: 'type', label: 'Type', flex: 1.5, render: (item) => item.transaction.type },
    {
      key: 'amount',
      label: 'Amount',
      flex: 1,
      align: 'right',
      render: (item) => {
        const sign = item.transaction.amount > 0 ? '+' : '';
        return `${sign}${item.transaction.amount}`;
      },
    },
    {
      key: 'source',
      label: 'Source',
      flex: 1.5,
      render: (item) => item.transaction.source ?? '-',
    },
    {
      key: 'date',
      label: 'Date',
      flex: 1,
      render: (item) => new Date(item.transaction.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      flex: 1,
      minWidth: 110,
      align: 'right',
      render: (item) => (
        <View style={styles.cellActions}>
          {item.wallet && (
            <Link href={`/admin/wallets/${item.wallet._id}`} asChild>
              <Pressable>
                <Text style={styles.link}>Wallet</Text>
              </Pressable>
            </Link>
          )}
          {item.transaction.purchaseId && (
            <Link href={`/admin/purchases/${item.transaction.purchaseId}`} asChild>
              <Pressable>
                <Text style={styles.link}>Purchase</Text>
              </Pressable>
            </Link>
          )}
        </View>
      ),
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Transactions"
        description="View and filter all wallet balance changes"
      />

      <AdminCard>
        <AdminCardTitle>Filters</AdminCardTitle>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.input}
            placeholder="Search email, purchaser ID, transaction ID..."
            placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
          <AdminButton label="Search" onPress={handleSearch} />
        </View>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>Type</Text>
            <PromoModeDropdown
              value={type}
              accessibilityLabel="Select type filter"
              options={[
                { value: '', label: 'All Types' },
                ...WALLET_TRANSACTION_TYPES.map((t) => ({ value: t, label: t })),
              ]}
              onValueChange={setTypeAndReset}
            />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>Source</Text>
            <PromoModeDropdown
              value={source}
              accessibilityLabel="Select source filter"
              options={SOURCE_OPTIONS}
              onValueChange={setSourceAndReset}
            />
          </View>
        </View>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>From (inclusive, YYYY-MM-DD)</Text>
            <TextInput
              value={dateFrom}
              onChangeText={setDateFrom}
              style={styles.input}
              placeholder="e.g. 2025-01-01"
              placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>To (inclusive, YYYY-MM-DD)</Text>
            <TextInput
              value={dateTo}
              onChangeText={setDateTo}
              style={styles.input}
              placeholder="e.g. 2025-12-31"
              placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
              autoCapitalize="none"
            />
          </View>
          <AdminButton label="Apply Dates" variant="secondary" onPress={handleApplyDates} />
        </View>
        {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
      </AdminCard>

      {transactions === undefined ? (
        <Text style={styles.loadingText}>Loading transactions...</Text>
      ) : (
        <>
          <AdminTable
            columns={columns}
            rows={(transactions.items as TransactionRow[])}
            rowKey={(item) => item.transaction._id}
            emptyText="No transactions found."
          />
          {(cursorStack.length > 0 || transactions.nextCursor != null) && (
            <AdminPagination
              hasPrevious={cursorStack.length > 0}
              hasNext={transactions.nextCursor != null}
              onPrevious={handlePrevious}
              onNext={handleNext}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

export function parseDateInput(value: string): number | undefined | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return 'invalid';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'invalid';
  }
  return date.getTime();
}

function startOfDay(epoch: number): number {
  const date = new Date(epoch);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function exclusiveNextDay(epoch: number): number {
  const date = new Date(epoch);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
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
  errorText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: ADMIN_THEME.colors.destructive,
  },
  loadingText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
    paddingVertical: 20,
  },
  cellActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  link: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    textDecorationLine: 'underline',
  },
});
