import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminScreenHeader } from '@/components/admin/AdminScreenHeader';
import PromoModeDropdown from '@/components/admin/PromoModeDropdown';
import { BRAND_ADMIN_TABLE, BRAND_RAISED_SURFACE, FONTS, SPACING } from '@/constants/theme';
import { HOME_SOFT_UI } from '@/themes';

const SOFT = HOME_SOFT_UI.colors;

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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AdminScreenHeader
        title="Audit Log"
        fallbackHref="/admin"
        backAccessibilityLabel="Back to admin overview"
      />

      <View style={[styles.panel, isCompact && styles.panelCompact]}>
        <Text style={styles.panelTitle}>Filters</Text>
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
      </View>

      {logs === undefined ? (
        <Text style={styles.empty}>Loading...</Text>
      ) : (
        <>
          {logs.items.length === 0 ? (
            <Text style={styles.empty}>No audit records found. Audit entries are written for admin promo, wallet, and purchase reversals.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell, styles.cellDate]}>Date</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellActor]}>Actor</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellAction]}>Action</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellTarget]}>Target</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellReason]}>Reason</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellDetails]}>Details</Text>
              </View>
              {logs.items.map((log: any) => {
                const expanded = expandedId === log._id;
                return (
                  <View key={log._id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Show audit details"
                      accessibilityState={{ expanded }}
                      onPress={() => setExpandedId(expanded ? null : log._id)}
                      style={styles.row}
                    >
                      <Text style={[styles.cell, styles.cellDate]}>
                        {new Date(log.timestamp).toLocaleString()}
                      </Text>
                      <Text style={[styles.cell, styles.cellActor]} numberOfLines={1}>
                        {log.actorEmail ?? log.actorUserId}
                      </Text>
                      <Text style={[styles.cell, styles.cellAction]} numberOfLines={1}>
                        {log.action}
                      </Text>
                      <Text style={[styles.cell, styles.cellTarget]} numberOfLines={1} selectable>
                        {log.targetType}: {log.targetId}
                      </Text>
                      <Text style={[styles.cell, styles.cellReason]} numberOfLines={2}>
                        {log.reason ?? '-'}
                      </Text>
                      <Text style={[styles.cell, styles.cellDetails, styles.detailsToggle]}>
                        {expanded ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                    {expanded && (
                      <View style={styles.detailPanel}>
                        <DetailBlock label="Before" value={formatSnapshot(log.before)} />
                        <DetailBlock label="After" value={formatSnapshot(log.after)} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {(cursorStack.length > 0 || logs.nextCursor != null) && (
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
                  (pressed || logs.nextCursor == null) && styles.disabledButton,
                ]}
                onPress={handleNext}
                disabled={logs.nextCursor == null}
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
  panelCompact: {
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
  },
  filterRowCompact: {
    flexDirection: 'column',
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
    fontSize: 12,
    color: SOFT.textPrimary,
  },
  headerCell: {
    fontFamily: FONTS.uiSemibold,
    color: SOFT.textMuted,
    fontSize: 12,
  },
  cellDate: {
    flex: 2,
  },
  cellActor: {
    flex: 2,
    minWidth: 0,
  },
  cellAction: {
    flex: 2,
    minWidth: 0,
  },
  cellTarget: {
    flex: 2,
    minWidth: 0,
  },
  cellReason: {
    flex: 2,
    minWidth: 0,
  },
  cellDetails: {
    flex: 1,
  },
  detailsToggle: {
    fontFamily: FONTS.uiSemibold,
    color: SOFT.textMuted,
    textAlign: 'right',
  },
  detailPanel: {
    backgroundColor: BRAND_ADMIN_TABLE.inputBackground,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  detailBlock: {
    gap: 2,
  },
  detailLabel: {
    fontFamily: FONTS.uiSemibold,
    fontSize: 11,
    color: SOFT.textMuted,
  },
  snapshotText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: SOFT.textPrimary,
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
