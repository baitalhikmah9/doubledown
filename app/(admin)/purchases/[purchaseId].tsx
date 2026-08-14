import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { BRAND_ADMIN_TABLE, BRAND_RAISED_SURFACE, COLORS, FONTS, SPACING } from '@/constants/theme';
import { HOME_SOFT_UI } from '@/themes';

const SOFT = HOME_SOFT_UI.colors;

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
        <AdminScreenHeader title="Purchase" fallbackHref="/admin/purchases" backAccessibilityLabel="Back to purchases" />
        <View style={styles.center}>
          <Text>Loading...</Text>
        </View>
      </ScrollView>
    );
  }

  if (detail === null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader title="Purchase" fallbackHref="/admin/purchases" backAccessibilityLabel="Back to purchases" />
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader title="Purchase" fallbackHref="/admin/purchases" backAccessibilityLabel="Back to purchases" />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Purchase</Text>
          {!alreadyReversed && !result ? (
            <Pressable style={styles.dangerButton} onPress={() => setShowReverse((s) => !s)}>
              <Text style={styles.dangerButtonText}>Reverse</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.detailsGrid}>
          <DetailItem label="Store" value={formatStore(purchase.store)} />
          <DetailItem label="Product" value={purchase.productKey} />
          <DetailItem label="Status" value={purchase.status} />
          <DetailItem label="Store Transaction ID" value={purchase.storeTransactionId} />
          <DetailItem label="Purchaser ID" value={purchase.purchaserAccountId} />
          <DetailItem label="Purchased At" value={new Date(purchase.purchasedAt).toLocaleString()} />
          {purchase.priceAmountMicros !== undefined && (
            <DetailItem label="Price" value={`${(purchase.priceAmountMicros / 1_000_000).toFixed(2)} ${purchase.currencyCode ?? ''}`.trim()} />
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
      </View>

      {showReverse && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Reverse Purchase Grant</Text>
          <Text style={styles.formLabel}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.input}
            placeholder="Why are you reversing this purchase?"
            placeholderTextColor={COLORS.disabled}
            multiline
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={() => setShowReverse(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.dangerButton, submitting && styles.disabledButton]}
              onPress={handleReverse}
              disabled={submitting}
            >
              <Text style={styles.dangerButtonText}>
                {submitting ? 'Reversing...' : 'Confirm Reversal'}
              </Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Linked Wallet</Text>
        {wallet ? (
          <View style={styles.detailsGrid}>
            <DetailItem label="Wallet ID" value={wallet._id} />
            <DetailItem label="Balance" value={String(wallet.balance)} />
          </View>
        ) : (
          <Text style={styles.empty}>No linked wallet.</Text>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Token Transactions</Text>
        {transactions.length === 0 ? (
          <Text style={styles.empty}>No wallet transactions for this purchase.</Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.cellType]}>Type</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellAmount]}>Amount</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellTx]}>Store Tx</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellReason]}>Reason</Text>
            </View>
            {transactions.map((tx) => (
              <View key={tx._id} style={styles.row}>
                <Text style={[styles.cell, styles.cellType]}>{tx.type}</Text>
                <Text style={[styles.cell, styles.cellAmount]}>{tx.amount}</Text>
                <Text style={[styles.cell, styles.cellTx]} numberOfLines={1} selectable>
                  {tx.storeTransactionId ?? '-'}
                </Text>
                <Text style={[styles.cell, styles.cellReason]} numberOfLines={1}>
                  {tx.metadata?.reason ?? '-'}
                </Text>
              </View>
            ))}
          </View>
        )}
        {originalGrant && <DetailItem label="Original Grant Amount" value={String(originalGrant.amount)} />}
      </View>
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
    gap: SPACING.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 120,
  },
  panel: {
    ...BRAND_RAISED_SURFACE,
    borderRadius: 18,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 16,
    color: SOFT.textPrimary,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  detailItem: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 160,
  },
  detailLabel: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 11,
    color: SOFT.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: SOFT.textPrimary,
  },
  warningText: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 13,
    color: COLORS.warning,
  },
  resultPanel: {
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    borderRadius: 12,
    padding: SPACING.md,
    gap: 4,
  },
  resultTitle: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.success,
  },
  resultText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: SOFT.textPrimary,
  },
  formLabel: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 12,
    color: SOFT.textMuted,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: BRAND_ADMIN_TABLE.inputBorder,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: SOFT.textPrimary,
    backgroundColor: BRAND_ADMIN_TABLE.inputBackground,
    minHeight: 80,
  },
  errorText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.error,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
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
  dangerButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  dangerButtonText: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 13,
    color: '#FFFFFF',
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
  cellType: {
    flex: 2,
  },
  cellAmount: {
    flex: 1,
  },
  cellTx: {
    flex: 2,
    minWidth: 0,
  },
  cellReason: {
    flex: 2,
  },
});
