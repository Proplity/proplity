'use client';

import { useRouter, useParams } from 'next/navigation';
import { TenantDetail } from '../../../components/TenantDetail';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  return <TenantDetail tenantId={Number(id)} onBack={() => router.push('/dashboard/tenants')} />;
}
