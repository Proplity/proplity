'use client';

import { useRouter } from 'next/navigation';
import { MaintenanceBoard } from '../../components/MaintenanceBoard';
import { navigateToPage } from '../navigateToPage';

export default function Page() {
  const router = useRouter();
  return <MaintenanceBoard onNavigate={(page) => navigateToPage(router, page)} />;
}
