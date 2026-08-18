import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import AdminIndexScreen from '@/app/(admin)';
import { AdminAccessBoundary } from '@/app/(admin)/_layout';
import { isAdminHostname } from '@/lib/admin/shell';

export default function IndexScreen() {
  if (Platform.OS === 'web' && isAdminHostname()) {
    return (
      <AdminAccessBoundary>
        <AdminIndexScreen />
      </AdminAccessBoundary>
    );
  }

  return <Redirect href="/(app)/" />;
}
