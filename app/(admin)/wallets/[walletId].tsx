import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminButton } from '@/components/admin/AdminButton';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

type WalletTx = {
  _id: string;
  type: string;
  amount: number;
  source?: string | null;
  metadata?: { reason?: string } | null;
};

export default function WalletDetailScreen() {
  const { walletId } = useLocalSearchParams<{ walletId: string }>();
  const wallet = useQuery(api.admin.getWallet, {
    walletId: walletId as any,
  });
  const transactions = useQuery(api.admin.listWalletTransactions, {
    walletId: walletId as any,
    limit: 20,
  });
  const adjustWallet = useMutation(api.admin.adjustWallet);
  const currentUser = useQuery(api.users.getCurrentProfile, {});

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const walletData = wallet;

  const numericAmount = parseInt(amount, 10);
  const resultingBalance = walletData ? walletData.wallet.balance + (Number.isNaN(numericAmount) ? 0 : numericAmount) : 0;
  const willBeNegative = walletData ? walletData.wallet.balance + (Number.isNaN(numericAmount) ? 0 : numericAmount) < 0 : false;

  const makeIdempotencyKey = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const handleReview = () => {
    setError('');
    if (Number.isNaN(numericAmount)) {
      setError('Enter a valid number.');
      return;
    }
    if (numericAmount === 0) {
      setError('Adjustment amount must be non-zero.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    if (!walletData?.wallet.purchaserAccountId) {
      setError('Wallet has no purchaser account id.');
      return;
    }
    setIdempotencyKey(makeIdempotencyKey());
    setConfirming(true);
  };

  const handleCancelReview = () => {
    setConfirming(false);
    setIdempotencyKey('');
  };

  const handleConfirm = async () => {
    setError('');
    const purchaserAccountId = walletData?.wallet.purchaserAccountId;
    if (!purchaserAccountId) {
      setError('Wallet has no purchaser account id.');
      return;
    }
    try {
      setSubmitting(true);
      await adjustWallet({
        purchaserAccountId,
        amount: numericAmount,
        reason: reason.trim(),
        idempotencyKey,
      });
      setAmount('');
      setReason('');
      setConfirming(false);
      setIdempotencyKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (wallet === undefined) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader
          title="Wallet Details"
          fallbackHref="/admin/wallets"
        />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading wallet details...</Text>
        </View>
      </ScrollView>
    );
  }

  if (!walletData) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader
          title="Wallet Details"
          fallbackHref="/admin/wallets"
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Wallet not found.</Text>
        </View>
      </ScrollView>
    );
  }

  const walletTitle =
    walletData.user?.email ?? walletData.user?.name ?? 'Wallet';

  const txColumns: AdminTableColumn<WalletTx>[] = [
    { key: 'type', label: 'Type', flex: 2, render: (tx) => tx.type },
    {
      key: 'amount',
      label: 'Amount',
      flex: 1,
      align: 'right',
      render: (tx) => {
        const sign = tx.amount > 0 ? '+' : '';
        return `${sign}${tx.amount}`;
      },
    },
    { key: 'source', label: 'Source', flex: 1, render: (tx) => tx.source ?? '-' },
    {
      key: 'reason',
      label: 'Reason',
      flex: 2,
      render: (tx) => tx.metadata?.reason ?? '-',
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title={walletTitle}
        description="Wallet details and balance adjustment"
        fallbackHref="/admin/wallets"
      />

      <AdminCard>
        <AdminCardTitle>Overview</AdminCardTitle>
        <View style={styles.detailsGrid}>
          <DetailItem label="User" value={walletData.user?.email ?? walletData.user?.name ?? 'Unknown'} />
          <DetailItem label="Purchaser ID" value={walletData.wallet.purchaserAccountId ?? '-'} />
          <DetailItem label="Balance" value={`${walletData.wallet.balance} tokens`} />
          <DetailItem label="Token Cap" value={walletData.wallet.tokenCap ? String(walletData.wallet.tokenCap) : 'Unlimited'} />
        </View>
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>Manual Adjustment</AdminCardTitle>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Amount (+/- tokens)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              placeholder="e.g. 10 or -5"
              placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.formField, { flex: 2 }]}>
            <Text style={styles.formLabel}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              style={styles.input}
              placeholder="Required reason for audit log"
              placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
            />
          </View>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {confirming ? (
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>Confirm Adjustment</Text>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Current balance</Text>
              <Text style={styles.confirmValue}>{walletData!.wallet.balance} tokens</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Adjustment</Text>
              <Text style={styles.confirmValue}>{numericAmount > 0 ? `+${numericAmount}` : numericAmount} tokens</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Resulting balance</Text>
              <Text style={[styles.confirmValue, willBeNegative && styles.confirmValueDanger]}>
                {resultingBalance} tokens
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Acting admin</Text>
              <Text style={styles.confirmValue}>
                {currentUser?.email ?? currentUser?.name ?? currentUser?.clerkId ?? 'Unknown'}
              </Text>
            </View>
            {willBeNegative && (
              <Text style={styles.warningText}>
                Warning: the resulting balance would be negative. The backend rejects debits that
                drive a wallet below zero.
              </Text>
            )}
            <View style={styles.buttonRow}>
              <AdminButton label="Cancel" variant="secondary" onPress={handleCancelReview} />
              <AdminButton
                label={submitting ? 'Applying...' : 'Confirm'}
                onPress={handleConfirm}
                disabled={submitting}
              />
            </View>
          </View>
        ) : (
          <AdminButton
            label="Review Adjustment"
            onPress={handleReview}
            style={styles.submitButton}
          />
        )}
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>Recent Transactions</AdminCardTitle>
        {transactions === undefined ? (
          <Text style={styles.loadingText}>Loading transactions...</Text>
        ) : (
          <AdminTable
            columns={txColumns}
            rows={transactions.items as WalletTx[]}
            rowKey={(tx) => tx._id}
            emptyText="No transactions."
          />
        )}
      </AdminCard>
    </ScrollView>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  center: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 160,
    gap: 4,
  },
  detailLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  detailValue: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.foreground,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formField: {
    flex: 1,
  },
  formLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
    marginBottom: 6,
  },
  input: {
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
  submitButton: {
    alignSelf: 'flex-start',
  },
  confirmPanel: {
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.md,
    padding: 16,
    gap: 10,
    backgroundColor: ADMIN_THEME.colors.secondary,
  },
  confirmTitle: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 14,
    color: ADMIN_THEME.colors.foreground,
    marginBottom: 4,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  confirmLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  confirmValue: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    textAlign: 'right',
  },
  confirmValueDanger: {
    color: ADMIN_THEME.colors.destructive,
    fontFamily: FONTS.uiSemibold,
  },
  warningText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.status.warning,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
});
