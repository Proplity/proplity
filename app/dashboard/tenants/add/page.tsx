'use client';

import { useRouter } from 'next/navigation';
import { AddTenantForm } from '../../../components/AddTenantForm';

export default function Page() {
  const router = useRouter();
  return (
    <AddTenantForm
      onBack={() => router.push('/dashboard/tenants')}
      onComplete={() => {
        alert('Tenancy created successfully! An invitation has been sent to the tenant.');
        router.push('/dashboard/tenants');
      }}
    />
  );
}
