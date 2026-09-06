import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminButton } from '@/components/admin/AdminButton';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';
import { isUnlimitedUsageCap } from '@/convex/lib/promoRules';
import { tokenProductKeyLabel } from '@/convex/lib/paymentCatalog';

type RedemptionRow = {
  redemption: { _id: string; userId: string; redeemedAt: number };
  user: { email?: string | null; clerkId?: string | null } | null;
  transaction: { type: string; amount: number } | null;
};

export default function PromoCodeDetailScreen() {
  const { promoCodeId } = useLocalSearchParams<{ promoCodeId: string }>();
  const promo = useQuery(api.admin.getPromoCode, { promoCodeId: promoCodeId as any });
  const deactivate = useMutation(api.admin.deactivatePromoCode);
  const deactivateDiscount = useAction(api.admin.deactivateDiscountPromo);
  const provisionDiscount = useAction(api.admin.provisionDiscountPromo);
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
      // Discount codes use the deactivateDiscountPromo action, which sets
      // local active=false (disable_pending) immediately, then attempts the
      // provider disable. If the provider disable fails, the promo stays
      // disable_pending and the hourly reconciliation retries.
      const isDiscount = promo?.promoCode.rewardType === 'discount';
      if (isDiscount) {
        const result = await deactivateDiscount({
          promoCodeId: promoCodeId as any,
          reason: reason.trim(),
        });
        if (!result.ok) {
          setError(
            `Local code deactivated (disable_pending). Provider disable failed: ${result.error}. ` +
              'The hourly reconciliation will retry the provider disable automatically.'
          );
          setShowDisable(false);
          setReason('');
          return;
        }
      } else {
        await deactivate({ promoCodeId: promoCodeId as any, reason: reason.trim() });
      }
      setShowDisable(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryProvisioning = async () => {
    setError('');
    try {
      setSubmitting(true);
      const result = await provisionDiscount({ promoCodeId: promoCodeId as any });
      if (!result.ok) {
        setError(
          `Provisioning retry failed: ${result.error}. The code stays inactive. ` +
            'Fix the configuration and retry again.'
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry provisioning');
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
        <AdminScreenHeader title="Promo Code Details" fallbackHref="/admin/promo-codes" />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading promo code...</Text>
        </View>
      </ScrollView>
    );
  }

  if (promo === null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <AdminScreenHeader title="Promo Code Details" fallbackHref="/admin/promo-codes" />
        <View style={styles.center}>
          <Text style={styles.errorText}>Promo code not found.</Text>
        </View>
      </ScrollView>
    );
  }

  const { promoCode, redemptions, restrictedUser } = promo;
  const isActive = promoCode.active !== false;
  const provisioningStatus = (promoCode as any).revenueCatProvisioningStatus as
    | 'pending'
    | 'provisioned'
    | 'failed'
    | 'disable_pending'
    | 'disabled'
    | undefined;
  const isDiscount = promoCode.rewardType === 'discount';
  const isFailedOrPendingDiscount =
    isDiscount && (provisioningStatus === 'failed' || provisioningStatus === 'pending');

  const redemptionColumns: AdminTableColumn<RedemptionRow>[] = [
    {
      key: 'user',
      label: 'User',
      flex: 2,
      render: (r) => r.user?.email ?? r.user?.clerkId ?? 'Unknown',
    },
    {
      key: 'userId',
      label: 'User ID',
      flex: 2,
      render: (r) => <Text style={styles.cellMono} selectable>{r.redemption.userId}</Text>,
    },
    {
      key: 'date',
      label: 'Date',
      flex: 1,
      render: (r) => new Date(r.redemption.redeemedAt).toLocaleDateString(),
    },
    {
      key: 'tx',
      label: 'Transaction',
      flex: 2,
      render: (r) => (r.transaction ? `${r.transaction.type} (${r.transaction.amount})` : '-'),
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title={promoCode.code}
        description="Promo code details and redemptions"
        fallbackHref="/admin/promo-codes"
        headerRight={
          <View style={styles.headerRightActions}>
            {isFailedOrPendingDiscount && (
              <AdminButton
                label={submitting ? 'Retrying...' : 'Retry Provisioning'}
                variant="secondary"
                onPress={handleRetryProvisioning}
                disabled={submitting}
              />
            )}
            {!isActive && !isDiscount && (
              <AdminButton
                label={submitting ? 'Reactivating...' : 'Reactivate'}
                variant="secondary"
                onPress={handleReactivate}
                disabled={submitting}
              />
            )}
            <AdminButton label="Edit" variant="secondary" onPress={openEdit} />
            {isActive ? (
              <AdminButton label="Disable" variant="danger" onPress={() => setShowDisable(true)} />
            ) : null}
          </View>
        }
      />

      <AdminCard>
        <AdminCardTitle>Overview</AdminCardTitle>
        <View style={styles.detailsGrid}>
          <DetailItem label="Mode" value={formatPromoMode(promoCode.mode)} />
          <DetailItem label="Scope" value={promoCode.redemptionScope ?? 'public'} />
          <DetailItem label="Reward Type" value={promoCode.rewardType} />
          <DetailItem
            label={promoCode.rewardType === 'discount' ? 'Discount' : 'Reward Amount'}
            value={
              promoCode.rewardType === 'discount'
                ? `${promoCode.discountPercent ?? 0}% off ${tokenProductKeyLabel(promoCode.productKey ?? 'bundle')}`
                : `${promoCode.rewardAmount} tokens`
            }
          />
          <DetailItem
            label="Usage Cap"
            value={isUnlimitedUsageCap(promoCode.usageCap) ? 'Unlimited' : String(promoCode.usageCap)}
          />
          {promoCode.affiliateEmail ? (
            <DetailItem label="Affiliate Email" value={promoCode.affiliateEmail} />
          ) : null}
          {promoCode.commissionPercent !== undefined ? (
            <DetailItem label="Commission" value={`${promoCode.commissionPercent}%`} />
          ) : null}
          <DetailItem label="Used Count" value={String(promoCode.usedCount ?? 0)} />
          <DetailItem label="Per-User Limit" value={String(promoCode.perUserLimit ?? 1)} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status</Text>
            <AdminStatusBadge label={isActive ? 'Active' : 'Inactive'} status={isActive ? 'active' : 'inactive'} />
          </View>
          {promoCode.rewardType === 'discount' && provisioningStatus ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>RC Provisioning</Text>
              <AdminStatusBadge
                label={provisioningStatus}
                status={
                  provisioningStatus === 'provisioned'
                    ? 'active'
                    : provisioningStatus === 'failed' || provisioningStatus === 'disable_pending'
                      ? 'inactive'
                      : 'inactive'
                }
              />
            </View>
          ) : null}
          {promoCode.rewardType === 'discount' && (promoCode as any).provisioningError ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Provisioning Error</Text>
              <Text style={styles.detailValue}>{(promoCode as any).provisioningError}</Text>
            </View>
          ) : null}
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
      </AdminCard>

      {showEdit && (
        <AdminCard>
          <AdminCardTitle>Edit Promo Code</AdminCardTitle>
          {(promoCode.usedCount ?? 0) > 0 && (
            <Text style={styles.warningText}>
              Warning: this code has {promoCode.usedCount} redemption(s). Changing some fields may affect future redemptions.
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
                placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                style={styles.input}
                placeholder="Internal notes"
                placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
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
                placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
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
                placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                autoCapitalize="none"
              />
            </View>
          </View>
          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
          <View style={styles.buttonRow}>
            <AdminButton label="Cancel" variant="secondary" onPress={() => setShowEdit(false)} />
            <AdminButton
              label={editSubmitting ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              disabled={editSubmitting}
            />
          </View>
        </AdminCard>
      )}

      {showDisable && (
        <AdminCard>
          <AdminCardTitle>Disable Promo Code</AdminCardTitle>
          <Text style={styles.formLabel}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.input}
            placeholder="Why are you disabling this code?"
            placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.buttonRow}>
            <AdminButton label="Cancel" variant="secondary" onPress={() => setShowDisable(false)} />
            <AdminButton
              label={submitting ? 'Disabling...' : 'Confirm Disable'}
              variant="danger"
              onPress={handleDeactivate}
              disabled={submitting}
            />
          </View>
        </AdminCard>
      )}

      <AdminCard>
        <AdminCardTitle>Redemptions ({redemptions.length})</AdminCardTitle>
        <AdminTable
          columns={redemptionColumns}
          rows={redemptions as RedemptionRow[]}
          rowKey={(r) => r.redemption._id}
          emptyText="No redemptions yet."
        />
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
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 140,
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
  formLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
    marginBottom: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formField: {
    flex: 1,
  },
  warningText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.status.warning,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  cellMono: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
  },
});
