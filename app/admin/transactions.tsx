import TransactionsScreen from '@/app/(admin)/transactions';
import { AdminAccessBoundary } from '@/app/(admin)/_layout';

export default function AdminRouteTransactionsScreen() {
  return (
    <AdminAccessBoundary>
      <TransactionsScreen />
    </AdminAccessBoundary>
  );
}
