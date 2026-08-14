import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { BRAND_ADMIN_TABLE, BRAND_RAISED_SURFACE, COLORS, FONTS, SPACING } from '@/constants/theme';
import { HOME_SOFT_UI } from '@/themes';

const SOFT = HOME_SOFT_UI.colors;

export default function PromoCodeDetailScreen() {
  const { promoCodeId } = useLocalSearchParams<{ promoCodeId: string }>();
  const promo = useQuery(api.admin.getPromoCode, { promoCodeId: promoCodeId as any });
  const deactivate = useMutation(api.admin.deactivatePromoCode);
  const updatePromo = useMutation(api.admin.updatePromoCode);

  const [showDisable, setShowDisable] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editRewardAmount, setEditRewardAmount] = useState('');
  const [editUsageCap, setEditUsageCap] = useState('');
  const [editPerUserLimit, setEditPerUserLimit] = useState('');
  const [editCampaignName, setEditCampaignName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editActiveFrom, setEditActiveFrom] = useState('');
  const [editActiveTo, setEditActiveTo] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleDeactivate = async () => {
    setError('');
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    try {
      setSubmitting(true);
      await deactivate({ promoCodeId: promoCodeId as any, reason: reason.trim() });
      setShowDisable(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    setError('');
    try {
      setSubmitting(true);
      await updatePromo({ promoCodeId: promoCodeId as any, active: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reactivate');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = () => {
    if (!promo) return;
    const { promoCode } = promo;
    setEditRewardAmount(String(promoCode.rewardAmount));
    setEditUsageCap(String(promoCode.usageCap));
    setEditPerUserLimit(String(promoCode.perUserLimit ?? ''));
    setEditCampaignName(promoCode.metadata?.campaignName ?? '');
    setEditNotes(promoCode.metadata?.notes ?? '');
    setEditActiveFrom(toLocalInput(promoCode.activeFrom));
    setEditActiveTo(toLocalInput(promoCode.activeTo));
    setEditError('');
    setShowEdit(true);
  };

  const handleSave = async () => {
    setEditError('');
    const payload: Record<string, unknown> = {};
    const reward = parseInt(editRewardAmount, 10);
    if (!Number.isNaN(reward) && reward !== promo!.promoCode.rewardAmount) payload.rewardAmount = reward;
    const cap = parseInt(editUsageCap, 10);
    if (!Number.isNaN(cap) && cap !== promo!.promoCode.usageCap) payload.usageCap = cap;
    if (editPerUserLimit.trim()) {
      const perUser = parseInt(editPerUserLimit, 10);
      if (!Number.isNaN(perUser) && perUser !== promo!.promoCode.perUserLimit) payload.perUserLimit = perUser;
    } else if (promo!.promoCode.perUserLimit !== undefined) {
      // Convex drops undefined optional args, so clear via an explicit flag.
      payload.clearPerUserLimit = true;
    }

    const activeFrom = parseInputToEpoch(editActiveFrom);
    const activeTo = parseInputToEpoch(editActiveTo);
    if (activeFrom === 'invalid') {
      setEditError('Active-from must be a valid date/time or empty.');
      return;
    }
    if (activeTo === 'invalid') {
      setEditError('Active-to must be a valid date/time or empty.');
      return;
    }
    if (activeFrom !== undefined && activeTo !== undefined && activeFrom >= activeTo) {
      setEditError('Active-from must be before active-to.');
      return;
    }
    if (activeFrom !== undefined && activeFrom !== promo!.promoCode.activeFrom) payload.activeFrom = activeFrom;
    if (activeTo !== undefined && activeTo !== promo!.promoCode.activeTo) payload.activeTo = activeTo;
    if (activeFrom === undefined && promo!.promoCode.activeFrom !== undefined) payload.clearActiveFrom = true;
    if (activeTo === undefined && promo!.promoCode.activeTo !== undefined) payload.clearActiveTo = true;

    const currentMetadata = promo!.promoCode.metadata ?? {};
    const metadata: Record<string, string> = {};
    const campaignName = editCampaignName.trim();
    const notes = editNotes.trim();
    if (campaignName !== (currentMetadata.campaignName ?? '')) metadata.campaignName = campaignName;
    if (notes !== (currentMetadata.notes ?? '')) metadata.notes = notes;
    if (Object.keys(metadata).length > 0) payload.metadata = metadata;

    if (Object.keys(payload).length === 0) {
      setShowEdit(false);
      return;
    }
    try {
      setEditSubmitting(true);
      await updatePromo({ promoCodeId: promoCodeId as any, ...(payload as any) });
      setShowEdit(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update promo code');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (promo === undefined) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader
          title="Promo code"
          fallbackHref="/admin/promo-codes"
          backAccessibilityLabel="Back to promo codes"
        />
        <View style={styles.center}>
          <Text>Loading...</Text>
        </View>
      </ScrollView>
    );
  }

  if (promo === null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader
          title="Promo code"
          fallbackHref="/admin/promo-codes"
          backAccessibilityLabel="Back to promo codes"
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Promo code not found.</Text>
        </View>
      </ScrollView>
    );
  }

  const { promoCode, redemptions, restrictedUser } = promo;
  const isActive = promoCode.active !== false;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title={promoCode.code}
        fallbackHref="/admin/promo-codes"
        backAccessibilityLabel="Back to promo codes"
      />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderSpacer} />
          {!isActive && (
            <Pressable
              style={[styles.secondaryButton, submitting && styles.disabledButton]}
              onPress={handleReactivate}
              disabled={submitting}
            >
              <Text style={styles.secondaryButtonText}>
                {submitting ? 'Reactivating...' : 'Reactivate'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={openEdit}>
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </Pressable>
          {isActive ? (
            <Pressable style={styles.dangerButton} onPress={() => setShowDisable(true)}>
              <Text style={styles.dangerButtonText}>Disable</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.detailsGrid}>
          <DetailItem label="Mode" value={formatPromoMode(promoCode.mode)} />
          <DetailItem label="Scope" value={promoCode.redemptionScope ?? 'public'} />
          <DetailItem label="Reward Type" value={promoCode.rewardType} />
          <DetailItem label="Reward Amount" value={String(promoCode.rewardAmount)} />
          <DetailItem label="Usage Cap" value={String(promoCode.usageCap)} />
          <DetailItem label="Used Count" value={String(promoCode.usedCount ?? 0)} />
          <DetailItem label="Per-User Limit" value={String(promoCode.perUserLimit ?? 1)} />
          <DetailItem label="Active" value={isActive ? 'Yes' : 'No'} />
          {restrictedUser && (
            <DetailItem
              label="Restricted Account"
              value={
                restrictedUser.email ??
                restrictedUser.name ??
                restrictedUser.clerkId ??
                promoCode.restrictedToPurchaserAccountId ??
                'Unknown'
              }
            />
          )}
          {promoCode.restrictedToPurchaserAccountId && (
            <DetailItem
              label="Restricted Purchaser ID"
              value={promoCode.restrictedToPurchaserAccountId}
            />
          )}
        </View>

        {promoCode.metadata?.campaignName && (
          <DetailItem label="Campaign" value={promoCode.metadata.campaignName} />
        )}
        {promoCode.metadata?.notes && (
          <DetailItem label="Notes" value={promoCode.metadata.notes} />
        )}
        {promoCode.metadata?.deactivationReason && (
          <DetailItem label="Deactivation Reason" value={promoCode.metadata.deactivationReason} />
        )}
      </View>

      {showEdit && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Edit Promo Code</Text>
          {(promoCode.usedCount ?? 0) > 0 && (
            <Text style={styles.warningText}>
              Warning: this code has {promoCode.usedCount} redemption(s). Changing some fields
              (such as reward amount) may be rejected or affect future redemptions.
            </Text>
          )}
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Reward Amount</Text>
              <TextInput
                value={editRewardAmount}
                onChangeText={setEditRewardAmount}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Usage Cap</Text>
              <TextInput
                value={editUsageCap}
                onChangeText={setEditUsageCap}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Per-User Limit</Text>
              <TextInput
                value={editPerUserLimit}
                onChangeText={setEditPerUserLimit}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Campaign Name</Text>
              <TextInput
                value={editCampaignName}
                onChangeText={setEditCampaignName}
                style={styles.input}
                placeholder="e.g. Spring 2025"
                placeholderTextColor={COLORS.disabled}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                style={styles.input}
                placeholder="Internal notes"
                placeholderTextColor={COLORS.disabled}
                multiline
              />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Active From (YYYY-MM-DDTHH:MM)</Text>
              <TextInput
                value={editActiveFrom}
                onChangeText={setEditActiveFrom}
                style={styles.input}
                placeholder="e.g. 2025-01-01T09:00"
                placeholderTextColor={COLORS.disabled}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Active To (YYYY-MM-DDTHH:MM)</Text>
              <TextInput
                value={editActiveTo}
                onChangeText={setEditActiveTo}
                style={styles.input}
                placeholder="e.g. 2025-12-31T23:59"
                placeholderTextColor={COLORS.disabled}
                autoCapitalize="none"
              />
            </View>
          </View>
          <Text style={styles.formHint}>
            Leave Active From / Active To empty to remove the schedule window.
          </Text>
          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={() => setShowEdit(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, editSubmitting && styles.disabledButton]}
              onPress={handleSave}
              disabled={editSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {showDisable && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Disable Promo Code</Text>
          <Text style={styles.formLabel}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.input}
            placeholder="Why are you disabling this code?"
            placeholderTextColor={COLORS.disabled}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={() => setShowDisable(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.dangerButton, submitting && styles.disabledButton]}
              onPress={handleDeactivate}
              disabled={submitting}
            >
              <Text style={styles.dangerButtonText}>
                {submitting ? 'Disabling...' : 'Confirm Disable'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Redemptions ({redemptions.length})</Text>
        {redemptions.length === 0 ? (
          <Text style={styles.empty}>No redemptions yet.</Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.cellUser]}>User</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellUserId]}>User ID</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellDate]}>Date</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellTx]}>Transaction</Text>
            </View>
            {redemptions.map(
              (r: {
                redemption: { _id: string; userId: string; redeemedAt: number };
                user: { email?: string | null; clerkId?: string | null } | null;
                transaction: { type: string; amount: number } | null;
              }) => (
                <View key={r.redemption._id} style={styles.row}>
                  <Text style={[styles.cell, styles.cellUser]}>
                    {r.user?.email ?? r.user?.clerkId ?? 'Unknown'}
                  </Text>
                  <Text
                    style={[styles.cell, styles.cellUserId, styles.cellMono]}
                    selectable
                  >
                    {r.redemption.userId}
                  </Text>
                  <Text style={[styles.cell, styles.cellDate]}>
                    {new Date(r.redemption.redeemedAt).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.cell, styles.cellTx]}>
                    {r.transaction ? `${r.transaction.type} (${r.transaction.amount})` : '-'}
                  </Text>
                </View>
              )
            )}
          </View>
        )}
      </View>
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

function toLocalInput(epoch?: number): string {
  if (epoch === undefined) return '';
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseInputToEpoch(value: string): number | undefined | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const time = new Date(trimmed).getTime();
  return Number.isNaN(time) ? 'invalid' : time;
}

function formatPromoMode(mode?: string) {
  switch (mode) {
    case 'public_single_use':
      return 'Public Single-Use';
    case 'public_multi_use':
      return 'Public Multi-Use';
    case 'account_single_use':
      return 'Account Single-Use';
    case 'account_multi_use':
      return 'Account Multi-Use';
    default:
      return 'Public Multi-Use';
  }
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
  panelHeaderSpacer: {
    flex: 1,
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
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 140,
  },
  detailLabel: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 11,
    color: SOFT.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: SOFT.textPrimary,
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
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  formField: {
    flex: 1,
  },
  warningText: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 13,
    color: COLORS.warning,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  submitButtonText: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
    letterSpacing: 0.6,
    color: '#FFFFFF',
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
  cellUser: {
    flex: 2,
  },
  cellUserId: {
    flex: 2,
    minWidth: 0,
  },
  cellMono: {
    fontSize: 11,
  },
  cellDate: {
    flex: 1,
  },
  cellTx: {
    flex: 2,
  },
});
