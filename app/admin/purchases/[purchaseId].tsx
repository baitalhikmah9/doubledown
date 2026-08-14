import PurchaseDetailScreen from '@/app/(admin)/purchases/[purchaseId]';
import { AdminAccessBoundary } from '@/app/(admin)/_layout';

export default function AdminRoutePurchaseDetailScreen() {
  return (
    <AdminAccessBoundary>
      <PurchaseDetailScreen />
    </AdminAccessBoundary>
  );
}
