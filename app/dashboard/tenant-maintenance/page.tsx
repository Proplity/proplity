'use client';

import { useRouter } from 'next/navigation';
import { TenantMaintenanceRequests } from '../../components/TenantMaintenanceRequests';
import { navigateToPage } from '../navigateToPage';

export default function Page() {
  const router = useRouter();
  return <TenantMaintenanceRequests onNavigate={(page) => navigateToPage(router, page)} />;
}
