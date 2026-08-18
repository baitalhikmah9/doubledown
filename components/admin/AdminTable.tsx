import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

export type AdminTableColumn<T> = {
  key: string;
  label: string;
  flex?: number;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  render: (row: T) => string | ReactNode;
};

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  rowAccessibilityLabel,
  rowFooter,
  emptyText = 'No records found.',
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  rowAccessibilityLabel?: (row: T) => string;
  rowFooter?: (row: T) => ReactNode;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        {columns.map((column) => (
          <View
            key={column.key}
            style={[
              styles.headerCell,
              { flex: column.flex ?? 1, minWidth: column.minWidth ?? 0 },
              column.align === 'right' && styles.cellRight,
              column.align === 'center' && styles.cellCenter,
            ]}
          >
            <Text style={styles.headerText}>{column.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, index) => {
        const cells = columns.map((column) => {
          const content = column.render(row);
          const cellStyle = [
            styles.cell,
            { flex: column.flex ?? 1, minWidth: column.minWidth ?? 0 },
            column.align === 'right' && styles.cellRight,
            column.align === 'center' && styles.cellCenter,
          ];
          return (
            <View key={column.key} style={cellStyle}>
              {typeof content === 'string' ? (
                <Text style={styles.cellText} numberOfLines={1}>
                  {content}
                </Text>
              ) : (
                content
              )}
            </View>
          );
        });
        const rowStyle = [styles.row, index < rows.length - 1 && styles.rowDivider];
        const footer = rowFooter?.(row);
        const rowElement = onRowPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rowAccessibilityLabel?.(row)}
            style={({ pressed }) => [rowStyle, pressed && styles.rowActive]}
            onPress={() => onRowPress(row)}
          >
            {cells}
          </Pressable>
        ) : (
          <View style={rowStyle}>{cells}</View>
        );
        return (
          <View key={rowKey(row)}>
            {rowElement}
            {footer}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.lg,
    overflow: 'hidden',
    backgroundColor: ADMIN_THEME.colors.card,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: ADMIN_THEME.colors.tableHeader,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.colors.border,
  },
  headerCell: {
    minWidth: 0,
  },
  headerText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    color: ADMIN_THEME.colors.mutedForeground,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: ADMIN_THEME.colors.card,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.colors.secondary,
  },
  rowActive: {
    backgroundColor: ADMIN_THEME.colors.secondary,
  },
  cell: {
    minWidth: 0,
  },
  cellText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.foreground,
  },
  cellRight: {
    alignItems: 'flex-end',
  },
  cellCenter: {
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.lg,
    backgroundColor: ADMIN_THEME.colors.card,
  },
  emptyText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: ADMIN_THEME.colors.mutedForeground,
  },
});
