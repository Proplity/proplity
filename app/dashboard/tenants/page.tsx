'use client';

import { useRouter } from 'next/navigation';
import { TenantManagement } from '../../components/TenantManagement';
import { navigateToPage } from '../navigateToPage';

export default function Page() {
  const router = useRouter();
  return <TenantManagement onNavigate={(page) => navigateToPage(router, page)} />;
}
