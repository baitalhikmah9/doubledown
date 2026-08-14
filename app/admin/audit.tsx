import AuditScreen from '@/app/(admin)/audit';
import { AdminAccessBoundary } from '@/app/(admin)/_layout';

export default function AdminRouteAuditScreen() {
  return (
    <AdminAccessBoundary>
      <AuditScreen />
    </AdminAccessBoundary>
  );
}
