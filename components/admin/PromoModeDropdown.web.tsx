import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PromoModeDropdownProps } from '@/components/admin/promoModeDropdown.types';
import { ADMIN_THEME } from '@/constants/adminTheme';
import { FONTS } from '@/constants/theme';

/**
 * Web admin: Radix Dropdown Menu (Shadcn UI style).
 */
export default function PromoModeDropdown({
  value,
  options,
  onValueChange,
  accessibilityLabel = 'Select option',
}: PromoModeDropdownProps) {
  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? value;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => [
            styles.trigger,
            { cursor: 'pointer' },
            pressed && styles.triggerPressed,
          ]}
        >
          <View style={styles.triggerInner}>
            <Text style={styles.triggerText} numberOfLines={1}>
              {selectedLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color={ADMIN_THEME.colors.mutedForeground} />
          </View>
        </Pressable>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="start"
          collisionPadding={8}
          style={StyleSheet.flatten(styles.content)}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <DropdownMenu.Item
                key={opt.value}
                textValue={opt.label}
                style={StyleSheet.flatten([
                  styles.item,
                  isSelected && styles.itemSelected,
                  { cursor: 'pointer' },
                ])}
                onSelect={() => onValueChange(opt.value)}
              >
                <Text
                  style={[styles.itemText, isSelected && styles.itemTextActive]}
                  numberOfLines={2}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color={ADMIN_THEME.colors.foreground} />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 36,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    borderRadius: ADMIN_THEME.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: ADMIN_THEME.colors.inputBackground,
  },
  triggerPressed: {
    opacity: 0.9,
    backgroundColor: ADMIN_THEME.colors.secondary,
  },
  triggerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerText: {
    flex: 1,
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
    minWidth: 0,
  },
  content: {
    zIndex: 1000,
    minWidth: 200,
    borderRadius: ADMIN_THEME.radius.md,
    borderWidth: 1,
    borderColor: ADMIN_THEME.colors.border,
    backgroundColor: ADMIN_THEME.colors.popover,
    padding: 4,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: ADMIN_THEME.radius.sm,
    gap: 8,
  },
  itemSelected: {
    backgroundColor: ADMIN_THEME.colors.secondary,
  },
  itemText: {
    flex: 1,
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: ADMIN_THEME.colors.foreground,
  },
  itemTextActive: {
    fontFamily: FONTS.uiMedium,
    color: ADMIN_THEME.colors.foreground,
  },
});
