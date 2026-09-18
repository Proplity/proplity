'use client';

import { useParams } from 'next/navigation';
import { MaintenanceDetail } from '../../../components/MaintenanceDetail';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <MaintenanceDetail requestId={id} />;
}
