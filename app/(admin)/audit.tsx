import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import { AdminCard, AdminCardTitle } from '@/components/admin/AdminCard';
import { AdminTable, type AdminTableColumn } from '@/components/admin/AdminTable';
import { AdminPagination } from '@/components/admin/AdminPagination';
import PromoModeDropdown from '@/components/admin/PromoModeDropdown';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'promo.create', label: 'Promo Created' },
  { value: 'promo.update', label: 'Promo Updated' },
  { value: 'promo.deactivate', label: 'Promo Deactivated' },
  { value: 'wallet.adjust', label: 'Wallet Adjusted' },
  { value: 'purchase.reverse', label: 'Purchase Reversed' },
];

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'All Targets' },
  { value: 'promo_code', label: 'Promo Code' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'store_purchase', label: 'Purchase' },
];

type AuditRow = {
  _id: string;
  timestamp: number;
  actorEmail?: string | null;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
};

function formatSnapshot(snapshot?: unknown): string {
  if (snapshot === undefined || snapshot === null) return '-';
  return JSON.stringify(snapshot, null, 2);
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.snapshotText} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function AuditScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<number[]>([]);

  const cursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;

  const logs = useQuery(api.admin.listAuditLog, {
    action: action || undefined,
    targetType: targetType || undefined,
    cursor,
    limit: 100,
  });

  const resetPagination = () => setCursorStack([]);

  const setActionAndReset = (value: string) => {
    setAction(value);
    resetPagination();
  };

  const setTargetTypeAndReset = (value: string) => {
    setTargetType(value);
    resetPagination();
  };

  const handleNext = () => {
    if (logs?.nextCursor != null) {
      setCursorStack([...cursorStack, logs.nextCursor]);
    }
  };

  const handlePrevious = () => setCursorStack(cursorStack.slice(0, -1));

  const columns: AdminTableColumn<AuditRow>[] = [
    {
      key: 'date',
      label: 'Date',
      flex: 2,
      render: (log) => new Date(log.timestamp).toLocaleString(),
    },
    {
      key: 'actor',
      label: 'Actor',
      flex: 2,
      render: (log) => log.actorEmail ?? log.actorUserId,
    },
    { key: 'action', label: 'Action', flex: 2, render: (log) => log.action },
    {
      key: 'target',
      label: 'Target',
      flex: 2,
      render: (log) => `${log.targetType}: ${log.targetId}`,
    },
    { key: 'reason', label: 'Reason', flex: 2, render: (log) => log.reason ?? '-' },
    {
      key: 'details',
      label: '',
      flex: 1,
      align: 'right',
      render: (log) => (
        <Text style={[styles.detailsToggle, expandedId === log._id && styles.detailsOpen]}>
          {expandedId === log._id ? 'Hide' : 'Details'}
        </Text>
      ),
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Audit Log"
        description="Immutable record of administrative operations"
      />

      <AdminCard>
        <AdminCardTitle>Filters</AdminCardTitle>
        <View style={[styles.filterRow, isCompact && styles.filterRowCompact]}>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>Action</Text>
            <PromoModeDropdown
              value={action}
              accessibilityLabel="Select action filter"
              options={ACTION_OPTIONS}
              onValueChange={setActionAndReset}
            />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.formLabel}>Target Type</Text>
            <PromoModeDropdown
              value={targetType}
              accessibilityLabel="Select target type filter"
              options={TARGET_TYPE_OPTIONS}
              onValueChange={setTargetTypeAndReset}
            />
          </View>
        </View>
      </AdminCard>

      {logs === undefined ? (
        <Text style={styles.loadingText}>Loading audit logs...</Text>
      ) : (
        <>
          <AdminTable
            columns={columns}
            rows={logs.items as AuditRow[]}
            rowKey={(log) => log._id}
            onRowPress={(log) => setExpandedId(expandedId === log._id ? null : log._id)}
            rowAccessibilityLabel={() => 'Show audit details'}
            emptyText="No audit records found."
            rowFooter={(log) =>
              expandedId === log._id ? (
                <View style={styles.detailPanel}>
                  <DetailBlock label="Before Snapshot" value={formatSnapshot(log.before)} />
                  <DetailBlock label="After Snapshot" value={formatSnapshot(log.after)} />
                </View>
              ) : null
            }
          />
          {(cursorStack.length > 0 || logs.nextCursor != null) && (
            <AdminPagination
              hasPrevious={cursorStack.length > 0}
              hasNext={logs.nextCursor != null}
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
  },
  filterRowCompact: {
    flexDirection: 'column',
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
  loadingText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
    paddingVertical: 20,
  },
  detailsToggle: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    textDecorationLine: 'underline',
  },
  detailsOpen: {
    color: ADMIN_THEME.colors.foreground,
  },
  detailPanel: {
    backgroundColor: ADMIN_THEME.colors.secondary,
    borderTopWidth: 1,
    borderTopColor: ADMIN_THEME.colors.border,
    padding: 16,
    gap: 12,
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  snapshotText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: ADMIN_THEME.colors.foreground,
    backgroundColor: ADMIN_THEME.colors.card,
    padding: 8,
    borderRadius: ADMIN_THEME.radius.sm,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
  },
});
