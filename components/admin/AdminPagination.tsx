import { View, StyleSheet } from 'react-native';
import { AdminButton } from './AdminButton';

export function AdminPagination({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.row}>
      <AdminButton
        label="Previous"
        variant="secondary"
        compact
        onPress={onPrevious}
        disabled={!hasPrevious}
      />
      <AdminButton
        label="Next"
        variant="secondary"
        compact
        onPress={onNext}
        disabled={!hasNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
  },
});
