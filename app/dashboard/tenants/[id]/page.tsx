'use client';

import { useParams } from 'next/navigation';
import { TenantDetail } from '../../../components/TenantDetail';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TenantDetail leaseId={id} />;
}
