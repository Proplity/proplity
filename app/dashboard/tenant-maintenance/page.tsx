'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { TenantMaintenanceRequests } from '../../components/TenantMaintenanceRequests';
import { navigateToPage } from '../navigateToPage';

export default function Page() {
  const router = useRouter();
  // The component reads ?request=<id> (from a notification link), which needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading requests…</div>}>
      <TenantMaintenanceRequests onNavigate={(page) => navigateToPage(router, page)} />
    </Suspense>
  );
}
