import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminButton } from '@/components/admin/AdminButton';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

type PurchaseTx = {
  _id: string;
  type: string;
  amount: number;
  storeTransactionId?: string | null;
  metadata?: { reason?: string } | null;
};

export default function PurchaseDetailScreen() {
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  const detail = useQuery(api.admin.getPurchase, { purchaseId: purchaseId as any });
  const reverse = useMutation(api.admin.reversePurchaseGrant);

  const [showReverse, setShowReverse] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ duplicate: boolean; balance: number } | null>(null);

  if (detail === undefined) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader title="Purchase Details" fallbackHref="/admin/purchases" />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading purchase details...</Text>
        </View>
      </ScrollView>
    );
  }

  if (detail === null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader title="Purchase Details" fallbackHref="/admin/purchases" />
        <View style={styles.center}>
          <Text style={styles.errorText}>Purchase not found.</Text>
        </View>
      </ScrollView>
    );
  }

  const { purchase, wallet, transactions } = detail;
  const originalGrant = transactions.find((t) => t.type === 'purchase_grant');
  const existingReversal = transactions.find((t) => t.type === 'purchase_reversal');
  const alreadyReversed = purchase.status === 'reversed' || Boolean(existingReversal);

  const handleReverse = async () => {
    setError('');
    setResult(null);
    if (!reason.trim()) {
      setError('A reason is required to reverse this purchase.');
      return;
    }
    if (alreadyReversed) {
      setError('This purchase has already been reversed.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await reverse({ purchaseId: purchaseId as any, reason: reason.trim() });
      setResult(res);
      setShowReverse(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reversal failed');
    } finally {
      setSubmitting(false);
    }
  };

  const txColumns: AdminTableColumn<PurchaseTx>[] = [
    { key: 'type', label: 'Type', flex: 2, render: (tx) => tx.type },
    { key: 'amount', label: 'Amount', flex: 1, render: (tx) => String(tx.amount) },
    {
      key: 'tx',
      label: 'Store Tx',
      flex: 2,
      render: (tx) => tx.storeTransactionId ?? '-',
    },
    {
      key: 'reason',
      label: 'Reason',
      flex: 2,
      render: (tx) => tx.metadata?.reason ?? '-',
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader title="Purchase Details" fallbackHref="/admin/purchases" />

      <AdminCard>
        <View style={styles.panelHeader}>
          <AdminCardTitle>Overview</AdminCardTitle>
          {!alreadyReversed && !result ? (
            <AdminButton
              label="Reverse Purchase"
              variant="danger"
              compact
              onPress={() => setShowReverse((s) => !s)}
            />
          ) : null}
        </View>
        <View style={styles.detailsGrid}>
          <DetailItem label="Store" value={formatStore(purchase.store)} />
          <DetailItem label="Product" value={purchase.productKey} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status</Text>
            <AdminStatusBadge label={purchase.status} status={purchase.status} />
          </View>
          <DetailItem label="Store Transaction ID" value={purchase.storeTransactionId} />
          <DetailItem label="Purchaser ID" value={purchase.purchaserAccountId} />
          <DetailItem label="Purchased At" value={new Date(purchase.purchasedAt).toLocaleString()} />
          {purchase.priceAmountMicros !== undefined && (
            <DetailItem
              label="Price"
              value={`${(purchase.priceAmountMicros / 1_000_000).toFixed(2)} ${purchase.currencyCode ?? ''}`.trim()}
            />
          )}
        </View>
        {alreadyReversed && (
          <Text style={styles.warningText}>
            This purchase has already been reversed. Duplicate reversal is blocked.
          </Text>
        )}
        {result && (
          <View style={styles.resultPanel}>
            <Text style={styles.resultTitle}>
              {result.duplicate ? 'Already reversed (no change).' : 'Purchase reversed successfully.'}
            </Text>
            <Text style={styles.resultText}>Resulting wallet balance: {result.balance} tokens</Text>
          </View>
        )}
      </AdminCard>

      {showReverse && (
        <AdminCard>
          <AdminCardTitle>Reverse Purchase Grant</AdminCardTitle>
          <Text style={styles.formLabel}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.textarea}
            placeholder="Why are you reversing this purchase?"
            placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
            multiline
          />
          <View style={styles.buttonRow}>
            <AdminButton label="Cancel" variant="secondary" onPress={() => setShowReverse(false)} />
            <AdminButton
              label={submitting ? 'Reversing...' : 'Confirm Reversal'}
              variant="danger"
              onPress={handleReverse}
              disabled={submitting}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </AdminCard>
      )}

      <AdminCard>
        <AdminCardTitle>Linked Wallet</AdminCardTitle>
        {wallet ? (
          <View style={styles.detailsGrid}>
            <DetailItem label="Wallet ID" value={wallet._id} />
            <DetailItem label="Balance" value={`${wallet.balance} tokens`} />
          </View>
        ) : (
          <Text style={styles.empty}>No linked wallet.</Text>
        )}
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>Token Transactions</AdminCardTitle>
        <AdminTable
          columns={txColumns}
          rows={transactions as PurchaseTx[]}
          rowKey={(tx) => tx._id}
          emptyText="No wallet transactions for this purchase."
        />
        {originalGrant && <DetailItem label="Original Grant Amount" value={String(originalGrant.amount)} />}
      </AdminCard>
    </ScrollView>
  );
}

function formatStore(store?: string | null) {
  if (store === 'app_store') return 'App Store';
  if (store === 'play_store') return 'Google Play';
  return store ?? '-';
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
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
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  warningText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.status.warning,
  },
  resultPanel: {
    backgroundColor: ADMIN_THEME.colors.status.successBg,
    borderColor: ADMIN_THEME.colors.status.successBorder,
    borderWidth: 1,
    borderRadius: ADMIN_THEME.radius.md,
    padding: 12,
    gap: 4,
  },
  resultTitle: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 13,
    color: ADMIN_THEME.colors.status.success,
  },
  resultText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
  },
  formLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  textarea: {
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.md,
    padding: 10,
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    backgroundColor: ADMIN_THEME.colors.inputBackground,
    minHeight: 80,
  },
  errorText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.destructive,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  empty: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
  },
});
