'use client';

import { useRouter } from 'next/navigation';
import { AdminDashboard } from '../components/AdminDashboard';
import { navigateToPage } from '../dashboard/navigateToPage';

export default function Page() {
  const router = useRouter();
  return <AdminDashboard onNavigate={(page) => navigateToPage(router, page)} />;
}
