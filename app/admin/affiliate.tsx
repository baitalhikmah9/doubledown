import AffiliateDashboardScreen from '@/app/(admin)/affiliate';
import { AdminAccessBoundary } from '@/app/(admin)/_layout';

export default function AdminRouteAffiliateScreen() {
  return (
    <AdminAccessBoundary>
      <AffiliateDashboardScreen />
    </AdminAccessBoundary>
  );
}
