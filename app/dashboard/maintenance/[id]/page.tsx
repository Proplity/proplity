'use client';

import { useRouter, useParams } from 'next/navigation';
import { MaintenanceDetail } from '../../../components/MaintenanceDetail';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  return <MaintenanceDetail requestId={id} onBack={() => router.push('/dashboard/maintenance')} />;
}
