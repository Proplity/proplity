'use client';

import { useRouter } from 'next/navigation';
import { AddTenantForm } from '../../../components/AddTenantForm';

export default function Page() {
  const router = useRouter();
  return (
    <AddTenantForm
      onBack={() => router.push('/dashboard/tenants')}
      onComplete={() => router.push('/dashboard/tenants')}
    />
  );
}
