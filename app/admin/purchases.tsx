import PurchasesScreen from '@/app/(admin)/purchases';
import { AdminAccessBoundary } from '@/app/(admin)/_layout';

export default function AdminRoutePurchasesScreen() {
  return (
    <AdminAccessBoundary>
      <PurchasesScreen />
    </AdminAccessBoundary>
  );
}
