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
import {
  WALLET_TRANSACTION_SOURCES,
  WALLET_TRANSACTION_SOURCE_LABELS,
  WALLET_TRANSACTION_TYPES,
} from '@/convex/lib/walletTransactionTypes';

const SOFT = HOME_SOFT_UI.colors;

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  ...WALLET_TRANSACTION_SOURCES.map((source) => ({
    value: source,
    label: WALLET_TRANSACTION_SOURCE_LABELS[source],
  })),
];

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
    // Send the exclusive start of the day after To so the whole selected day
    // is included (a transaction at 23:59:59.999 of the To day must match).
    setTo(parsedTo !== undefined ? exclusiveNextDay(parsedTo) : undefined);
    resetPagination();
  };

  const handleNext = () => {
    if (transactions?.nextCursor != null) {
      setCursorStack([...cursorStack, transactions.nextCursor]);
    }
  };

  const handlePrevious = () => setCursorStack(cursorStack.slice(0, -1));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Transactions"
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
            placeholder="Email, purchaser ID, transaction ID"
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
              style={styles.searchInput}
              placeholder="e.g. 2025-01-01"
              placeholderTextColor={COLORS.disabled}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>To (inclusive, YYYY-MM-DD)</Text>
            <TextInput
              value={dateTo}
              onChangeText={setDateTo}
              style={styles.searchInput}
              placeholder="e.g. 2025-12-31"
              placeholderTextColor={COLORS.disabled}
              autoCapitalize="none"
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleApplyDates}
          >
            <Text style={styles.primaryButtonText}>Apply Dates</Text>
          </Pressable>
        </View>
        {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
        <Text style={styles.formHint}>
          Date filters are inclusive: transactions on or between the selected days are shown.
        </Text>
      </View>

      {transactions === undefined ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : (
        <>
          {transactions.items.length === 0 ? (
            <Text style={styles.empty}>No transactions found.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell, styles.cellEmail]}>Account</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellType]}>Type</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellAmount]}>Amount</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellSource]}>Source</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellDate]}>Date</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellActions]} />
              </View>
              {transactions.items.map((item: any) => (
                <View key={item.transaction._id} style={styles.row}>
                  <Text style={[styles.cell, styles.cellEmail]} numberOfLines={1}>
                    {item.userEmail ?? item.wallet?.purchaserAccountId ?? '-'}
                  </Text>
                  <Text style={[styles.cell, styles.cellType]} numberOfLines={1}>
                    {item.transaction.type}
                  </Text>
                  <Text style={[styles.cell, styles.cellAmount]}>{item.transaction.amount}</Text>
                  <Text style={[styles.cell, styles.cellSource]}>{item.transaction.source ?? '-'}</Text>
                  <Text style={[styles.cell, styles.cellDate]}>
                    {new Date(item.transaction.createdAt).toLocaleDateString()}
                  </Text>
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
                </View>
              ))}
            </View>
          )}
          {(cursorStack.length > 0 || transactions.nextCursor != null) && (
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
                  (pressed || transactions.nextCursor == null) && styles.disabledButton,
                ]}
                onPress={handleNext}
                disabled={transactions.nextCursor == null}
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

/**
 * Local midnight of the day after `epoch` (DST-safe), used as the exclusive
 * upper bound so every millisecond of the selected day is included.
 */
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
  formHint: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: SOFT.textMuted,
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
  errorText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.error,
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
  cellEmail: {
    flex: 2,
    minWidth: 0,
  },
  cellType: {
    flex: 2,
    minWidth: 0,
  },
  cellAmount: {
    flex: 1,
    textAlign: 'right',
  },
  cellSource: {
    flex: 1,
  },
  cellDate: {
    flex: 1,
  },
  cellActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'flex-end',
    minWidth: 110,
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
