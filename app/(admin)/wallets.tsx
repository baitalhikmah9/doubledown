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
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

type WalletRow = {
  wallet: {
    _id: string;
    purchaserAccountId?: string | null;
    balance: number;
  };
  user: { email?: string | null; name?: string | null } | null;
};

export default function WalletsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const results = useQuery(
    api.admin.searchWallets,
    submittedQuery ? { query: submittedQuery, limit: 20 } : 'skip'
  );

  const handleSearch = () => {
    setSubmittedQuery(query.trim());
  };

  const columns: AdminTableColumn<WalletRow>[] = [
    {
      key: 'user',
      label: 'User',
      flex: 2,
      render: (row) => row.user?.email ?? row.user?.name ?? 'Unknown',
    },
    {
      key: 'id',
      label: 'Purchaser Account ID',
      flex: 2,
      render: (row) => row.wallet.purchaserAccountId ?? '-',
    },
    {
      key: 'balance',
      label: 'Balance',
      flex: 1,
      align: 'right',
      render: (row) => `${row.wallet.balance} tokens`,
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
        title="Wallets"
        description="Search user wallets and manage balances"
      />

      <AdminCard>
        <AdminCardTitle>Search Wallets</AdminCardTitle>
        <View style={[styles.searchRow, isCompact && styles.searchRowCompact]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholder="Search email, Clerk ID, or purchaser account ID..."
            placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
          <AdminButton label="Search" onPress={handleSearch} />
        </View>
      </AdminCard>

      {submittedQuery && results === undefined ? (
        <Text style={styles.loadingText}>Searching wallets...</Text>
      ) : results && results.length > 0 ? (
        <AdminTable
          columns={columns}
          rows={results as WalletRow[]}
          rowKey={(row) => row.wallet._id}
          onRowPress={(row) => router.push(`/admin/wallets/${row.wallet._id}`)}
          emptyText="No wallets found."
        />
      ) : submittedQuery ? (
        <AdminCard>
          <Text style={styles.empty}>No wallets found matching &ldquo;{submittedQuery}&rdquo;.</Text>
        </AdminCard>
      ) : null}
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
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  searchInput: {
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
  empty: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 20,
  },
  link: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    textDecorationLine: 'underline',
  },
});
