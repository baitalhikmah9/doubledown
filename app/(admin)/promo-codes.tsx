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
import { useQuery, useMutation, useAction } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminButton } from '@/components/admin/AdminButton';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import PromoModeDropdown from '@/components/admin/PromoModeDropdown';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';
import { DEFAULT_TOKEN_PRODUCTS } from '@/convex/lib/paymentCatalog';
import { generatePromoCode, isUnlimitedUsageCap } from '@/convex/lib/promoRules';
import { adminHref } from '@/lib/admin/shell';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  expired: 'Expired',
  scheduled: 'Scheduled',
  exhausted: 'Exhausted',
};

const COUPON_MODES = [
  {
    value: 'public_single_use',
    label: 'Public Single-Use',
    requiresAccount: false,
    requiresCap: false,
  },
  {
    value: 'public_multi_use',
    label: 'Public Multi-Use',
    requiresAccount: false,
    requiresCap: true,
  },
  {
    value: 'account_single_use',
    label: 'Account Single-Use',
    requiresAccount: true,
    requiresCap: false,
  },
  {
    value: 'account_multi_use',
    label: 'Account Multi-Use',
    requiresAccount: true,
    requiresCap: true,
  },
] as const;

type CouponMode = (typeof COUPON_MODES)[number]['value'];

const REWARD_TYPES = [
  { value: 'tokens', label: 'Free tokens' },
  { value: 'discount', label: 'Bundle discount' },
] as const;

type RewardType = (typeof REWARD_TYPES)[number]['value'];

const BUNDLE_OPTIONS = DEFAULT_TOKEN_PRODUCTS.map((product) => ({
  value: product.productKey,
  label: `${product.tokensGranted}-token bundle`,
}));

/** Affiliate preset auto-deadline: 30 days from creation. Admins can clear or
 * change it after creation via the promo detail editor. */
const AFFILIATE_PRESET_DEADLINE_DAYS = 30;

type WalletSearchResult = {
  wallet: {
    _id: string;
    purchaserAccountId?: string | null;
    balance: number;
  };
  user: {
    _id: Id<'users'>;
    email?: string | null;
    name?: string | null;
    clerkId?: string | null;
  } | null;
};

type PromoRow = {
  _id: string;
  code: string;
  rewardType?: string;
  rewardAmount: number;
  discountPercent?: number;
  productKey?: string;
  usedCount?: number;
  usageCap: number;
  affiliateEmail?: string;
  status: string;
};

export default function PromoCodesScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const promoCodes = useQuery(api.admin.listPromoCodes, {
    query: filter || undefined,
    status: (statusFilter || undefined) as any,
    mode: modeFilter || undefined,
    limit: 50,
  });
  const createPromo = useMutation(api.admin.createPromoCode);
  const provisionDiscount = useAction(api.admin.provisionDiscountPromo);

  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [rewardType, setRewardType] = useState<RewardType>('tokens');
  const [rewardAmount, setRewardAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [productKey, setProductKey] = useState(DEFAULT_TOKEN_PRODUCTS[0]?.productKey ?? 'bundle_10');
  const [usageCap, setUsageCap] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const [affiliatePreset, setAffiliatePreset] = useState(false);
  const [affiliateEmail, setAffiliateEmail] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('');
  const [affiliateDeadlineEnabled, setAffiliateDeadlineEnabled] = useState(true);
  const [mode, setMode] = useState<CouponMode>('public_single_use');
  const [accountQuery, setAccountQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<WalletSearchResult | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selectedMode = COUPON_MODES.find((item) => item.value === mode) ?? COUPON_MODES[0];
  const amount = parseInt(rewardAmount, 10);
  const parsedDiscount = parseInt(discountPercent, 10);
  const parsedCommission = parseInt(commissionPercent, 10);
  const cap = parseInt(usageCap, 10);
  const needsCap = selectedMode.requiresCap && !unlimited;
  // Affiliate preset auto-deadline: 30 days from creation, surfaced so admins
  // see the exact expiry before submitting. They can disable it here or clear
  // it later from the promo detail editor.
  const affiliateDeadlineEpoch =
    affiliatePreset && affiliateDeadlineEnabled
      ? Date.now() + AFFILIATE_PRESET_DEADLINE_DAYS * 24 * 60 * 60 * 1000
      : undefined;
  const affiliateDeadlineLabel = affiliateDeadlineEpoch
    ? new Date(affiliateDeadlineEpoch).toLocaleString()
    : null;
  const isSubmitDisabled =
    submitting ||
    !code.trim() ||
    (rewardType === 'tokens'
      ? Number.isNaN(amount) || amount <= 0
      : Number.isNaN(parsedDiscount) || parsedDiscount < 1 || parsedDiscount > 100 || !productKey) ||
    (needsCap && (Number.isNaN(cap) || cap <= 0)) ||
    (selectedMode.requiresAccount && !selectedAccount?.user?._id) ||
    (affiliatePreset &&
      (!affiliateEmail.trim() || Number.isNaN(parsedCommission) || parsedCommission < 1 || parsedCommission > 100));
  const accountResults = useQuery(
    api.admin.searchWallets,
    selectedMode.requiresAccount && accountQuery.trim()
      ? { query: accountQuery.trim(), limit: 6 }
      : 'skip'
  ) as WalletSearchResult[] | undefined;

  const handleCreate = async () => {
    setError('');
    const parsedAmount = rewardType === 'tokens' ? parseInt(rewardAmount, 10) : 0;
    const parsedCap = unlimited ? 0 : selectedMode.requiresCap ? parseInt(usageCap, 10) : 1;
    const parsedDiscountValue = parseInt(discountPercent, 10);
    const parsedCommissionValue = parseInt(commissionPercent, 10);

    if (!code.trim()) {
      setError('Code is required.');
      return;
    }

    if (rewardType === 'tokens' && Number.isNaN(parsedAmount)) {
      setError('Token amount is required.');
      return;
    }

    if (
      rewardType === 'discount' &&
      (Number.isNaN(parsedDiscountValue) || parsedDiscountValue < 1 || parsedDiscountValue > 100)
    ) {
      setError('Discount percent must be between 1 and 100.');
      return;
    }

    if (needsCap && (Number.isNaN(parsedCap) || parsedCap <= 0)) {
      setError('Max redemptions must be a positive number.');
      return;
    }

    if (selectedMode.requiresAccount && !selectedAccount?.user?._id) {
      setError('Choose the restricted account for this coupon.');
      return;
    }

    if (affiliatePreset && !affiliateEmail.trim()) {
      setError('Affiliate email is required.');
      return;
    }

    if (
      affiliatePreset &&
      (Number.isNaN(parsedCommissionValue) || parsedCommissionValue < 1 || parsedCommissionValue > 100)
    ) {
      setError('Commission percent must be between 1 and 100.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await createPromo({
        code: code.trim(),
        rewardAmount: parsedAmount,
        usageCap: parsedCap,
        mode,
        restrictedToUserId: selectedAccount?.user?._id,
        restrictedToPurchaserAccountId: selectedAccount?.wallet.purchaserAccountId ?? undefined,
        rewardType,
        discountPercent: rewardType === 'discount' ? parsedDiscountValue : undefined,
        productKey: rewardType === 'discount' ? productKey : undefined,
        affiliateEmail: affiliatePreset ? affiliateEmail.trim() : undefined,
        commissionPercent: affiliatePreset ? parsedCommissionValue : undefined,
        activeTo: affiliateDeadlineEpoch,
        metadata: campaignName || notes ? { campaignName: campaignName || undefined, notes: notes || undefined } : undefined,
      });

      // Discount codes are inserted inactive + provisioning_pending. Provision
      // the RevenueCat discount + code now. On failure the local row stays
      // inactive and the error is surfaced; no unusable code is presented.
      if (rewardType === 'discount') {
        const promoCodeId = result.promoCodeId as Id<'promo_codes'>;
        const provisioned = await provisionDiscount({ promoCodeId });
        if (!provisioned.ok) {
          setError(
            `Local code created but RevenueCat provisioning failed: ${provisioned.error}. ` +
              'The code is inactive and not usable. Fix the configuration and retry from the promo detail page.'
          );
          // Keep the form open so the admin sees the error and can retry.
          setSubmitting(false);
          return;
        }
      }

      setCode('');
      setRewardType('tokens');
      setRewardAmount('');
      setDiscountPercent('');
      setProductKey(DEFAULT_TOKEN_PRODUCTS[0]?.productKey ?? 'bundle_10');
      setUsageCap('');
      setUnlimited(false);
      setAffiliatePreset(false);
      setAffiliateEmail('');
      setCommissionPercent('');
      setAffiliateDeadlineEnabled(true);
      setMode('public_single_use');
      setAccountQuery('');
      setSelectedAccount(null);
      setCampaignName('');
      setNotes('');
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create promo code');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: AdminTableColumn<PromoRow>[] = [
    { key: 'code', label: 'Code', flex: 2, render: (promo) => promo.code },
    {
      key: 'reward',
      label: 'Reward',
      flex: 1.4,
      align: 'center',
      render: (promo) =>
        promo.rewardType === 'discount'
          ? `${promo.discountPercent ?? 0}% off ${promo.productKey ?? 'bundle'}`
          : `${promo.rewardAmount} tokens`,
    },
    {
      key: 'cap',
      label: 'Used / Cap',
      flex: 1,
      align: 'center',
      render: (promo) =>
        `${promo.usedCount ?? 0} / ${isUnlimitedUsageCap(promo.usageCap) ? 'Unlimited' : promo.usageCap}`,
    },
    {
      key: 'status',
      label: 'Status',
      flex: 1,
      align: 'center',
      render: (promo) => (
        <AdminStatusBadge
          label={STATUS_LABELS[promo.status] ?? promo.status}
          status={promo.status}
        />
      ),
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Promo Codes"
        description="Create and manage coupon redemption codes"
        headerRight={
          <AdminButton
            label={showCreate ? 'Cancel' : 'Create'}
            variant={showCreate ? 'secondary' : 'primary'}
            accessibilityLabel={
              showCreate ? 'Cancel creating promo code' : 'Create new promo code'
            }
            onPress={() => setShowCreate((s) => !s)}
          />
        }
      />

      {showCreate && (
        <AdminCard>
          <AdminCardTitle>New Promo Code</AdminCardTitle>
          <View style={[styles.formGrid, isCompact && styles.formGridCompact]}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Code</Text>
              <View style={styles.codeRow}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  style={[styles.input, styles.codeInput]}
                  placeholder="e.g. WELCOME2024"
                  placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                  autoCapitalize="characters"
                />
                <AdminButton
                  label="Generate"
                  variant="secondary"
                  accessibilityLabel="Generate random code"
                  onPress={() => setCode(generatePromoCode())}
                />
              </View>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Reward</Text>
              <PromoModeDropdown
                value={rewardType}
                accessibilityLabel="Select reward type"
                options={REWARD_TYPES}
                onValueChange={(next) => setRewardType(next as RewardType)}
              />
            </View>
            {rewardType === 'tokens' ? (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Token Amount</Text>
                <TextInput
                  value={rewardAmount}
                  onChangeText={setRewardAmount}
                  style={styles.input}
                  placeholder="Tokens"
                  placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Discount Percent</Text>
                  <TextInput
                    value={discountPercent}
                    onChangeText={setDiscountPercent}
                    style={styles.input}
                    placeholder="e.g. 20"
                    placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Token Bundle</Text>
                  <PromoModeDropdown
                    value={productKey}
                    accessibilityLabel="Select token bundle"
                    options={BUNDLE_OPTIONS}
                    onValueChange={setProductKey}
                  />
                </View>
                <Text style={styles.helperText}>
                  Creating this discount provisions a RevenueCat percentage
                  discount and code automatically. The code is usable on web
                  checkout only after provisioning succeeds. If provisioning
                  fails, the code stays inactive and is not presented to users.
                </Text>
              </>
            )}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Mode</Text>
              <PromoModeDropdown
                value={mode}
                options={COUPON_MODES}
                onValueChange={(next) => {
                  const item = COUPON_MODES.find((m) => m.value === next);
                  setMode(next as CouponMode);
                  setError('');
                  if (item && !item.requiresAccount) {
                    setAccountQuery('');
                    setSelectedAccount(null);
                  }
                }}
              />
            </View>
            <View style={styles.checkboxRow}>
              <AdminButton
                label={affiliatePreset ? 'Affiliate preset on' : 'Affiliate preset'}
                variant={affiliatePreset ? 'primary' : 'secondary'}
                accessibilityLabel="Toggle affiliate preset"
                onPress={() => {
                  const next = !affiliatePreset;
                  setAffiliatePreset(next);
                  if (next) {
                    setUnlimited(true);
                    setMode('public_multi_use');
                    setAccountQuery('');
                    setSelectedAccount(null);
                    setAffiliateDeadlineEnabled(true);
                  }
                }}
              />
              <AdminButton
                label={unlimited ? 'Unlimited uses' : 'Limited uses'}
                variant={unlimited ? 'primary' : 'secondary'}
                accessibilityLabel="Toggle unlimited uses"
                onPress={() => setUnlimited((value) => !value)}
              />
            </View>
            {affiliatePreset && (
              <>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Affiliate Email</Text>
                  <TextInput
                    value={affiliateEmail}
                    onChangeText={setAffiliateEmail}
                    style={styles.input}
                    placeholder="creator@example.com"
                    placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Commission Percent</Text>
                  <TextInput
                    value={commissionPercent}
                    onChangeText={setCommissionPercent}
                    style={styles.input}
                    placeholder="e.g. 10"
                    placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.checkboxRow}>
                  <AdminButton
                    label={
                      affiliateDeadlineEnabled
                        ? `Auto-deadline on (${affiliateDeadlineLabel ?? ''})`
                        : 'Auto-deadline off'
                    }
                    variant={affiliateDeadlineEnabled ? 'primary' : 'secondary'}
                    accessibilityLabel="Toggle 30-day affiliate auto-deadline"
                    onPress={() => setAffiliateDeadlineEnabled((value) => !value)}
                  />
                </View>
                {affiliateDeadlineEnabled && (
                  <Text style={styles.helperText}>
                    Auto-deadline: {AFFILIATE_PRESET_DEADLINE_DAYS} days from creation
                    {affiliateDeadlineLabel ? ` (${affiliateDeadlineLabel})` : ''}. The code
                    stops working after this date. Clear or change it later from the promo
                    detail editor.
                  </Text>
                )}
              </>
            )}
            {needsCap && (
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Max Redemptions</Text>
                <TextInput
                  value={usageCap}
                  onChangeText={setUsageCap}
                  style={styles.input}
                  placeholder="Max redemptions"
                  placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            )}
            {selectedMode.requiresAccount && (
              <View style={styles.formFieldWide}>
                <Text style={styles.formLabel}>Restricted Account</Text>
                <TextInput
                  value={accountQuery}
                  onChangeText={(value) => {
                    setAccountQuery(value);
                    setSelectedAccount(null);
                  }}
                  style={styles.input}
                  placeholder="Search email, Clerk id, or purchaser id"
                  placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
                  autoCapitalize="none"
                />
                {selectedAccount ? (
                  <Text style={styles.selectedAccountText}>
                    Selected: {selectedAccount.user?.email ?? selectedAccount.user?.name ?? selectedAccount.user?.clerkId ?? selectedAccount.wallet.purchaserAccountId}
                  </Text>
                ) : accountResults && accountResults.length > 0 ? (
                  <View style={styles.accountResults}>
                    {accountResults.map((result) => (
                      <Pressable
                        key={result.wallet._id}
                        onPress={() => {
                          setSelectedAccount(result);
                          setAccountQuery(result.user?.email ?? result.user?.clerkId ?? result.wallet.purchaserAccountId ?? '');
                        }}
                        style={styles.accountResult}
                      >
                        <Text style={styles.accountResultTitle}>
                          {result.user?.email ?? result.user?.name ?? result.user?.clerkId ?? 'Unknown account'}
                        </Text>
                        <Text style={styles.accountResultMeta}>
                          {result.wallet.purchaserAccountId ?? 'No purchaser id'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : accountQuery.trim() ? (
                  <Text style={styles.selectedAccountText}>No matching accounts found.</Text>
                ) : null}
              </View>
            )}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Campaign Name</Text>
              <TextInput
                value={campaignName}
                onChangeText={setCampaignName}
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
              />
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AdminButton
            label={submitting ? 'Creating...' : 'Create Promo Code'}
            onPress={handleCreate}
            disabled={isSubmitDisabled}
            style={styles.submitButton}
          />
        </AdminCard>
      )}

      <AdminCard>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <TextInput
            value={filter}
            onChangeText={setFilter}
            style={styles.filterInput}
            placeholder="Search codes..."
            placeholderTextColor={ADMIN_THEME.colors.mutedForeground}
          />
          <View style={styles.filterField}>
            <PromoModeDropdown
              value={statusFilter}
              accessibilityLabel="Select status filter"
              options={[
                { value: '', label: 'All Statuses' },
                ...Object.keys(STATUS_LABELS).map((key) => ({ value: key, label: STATUS_LABELS[key] })),
              ]}
              onValueChange={setStatusFilter}
            />
          </View>
          <View style={styles.filterField}>
            <PromoModeDropdown
              value={modeFilter}
              accessibilityLabel="Select mode filter"
              options={[
                { value: '', label: 'All Modes' },
                ...COUPON_MODES.map((m) => ({ value: m.value, label: m.label })),
              ]}
              onValueChange={setModeFilter}
            />
          </View>
        </View>
      </AdminCard>

      {promoCodes === undefined ? (
        <Text style={styles.loadingText}>Loading promo codes...</Text>
      ) : (
        <AdminTable
          columns={columns}
          rows={promoCodes.items as PromoRow[]}
          rowKey={(promo) => promo._id}
          onRowPress={(promo) => router.push(adminHref(`/admin/promo-codes/${promo._id}`) as any)}
          emptyText="No promo codes found."
        />
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
  submitButton: {
    alignSelf: 'flex-start',
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  formGridCompact: {
    flexDirection: 'column',
  },
  formField: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 180,
  },
  formFieldWide: {
    flexBasis: '62%',
    flexGrow: 1,
    minWidth: 260,
  },
  formLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flexBasis: '100%',
  },
  helperText: {
    flexBasis: '100%',
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
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
  selectedAccountText: {
    marginTop: 6,
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  accountResults: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.md,
    overflow: 'hidden',
    backgroundColor: ADMIN_THEME.colors.card,
  },
  accountResult: {
    backgroundColor: ADMIN_THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  accountResultTitle: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
  },
  accountResultMeta: {
    marginTop: 2,
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  filterRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterField: {
    flex: 1,
    minWidth: 160,
  },
  filterInput: {
    flex: 1,
    maxWidth: 320,
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
});
