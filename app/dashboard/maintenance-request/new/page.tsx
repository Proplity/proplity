'use client';

import { useRouter } from 'next/navigation';
import { MaintenanceRequestForm } from '../../../components/MaintenanceRequestForm';

export default function Page() {
  const router = useRouter();
  return (
    <MaintenanceRequestForm
      onBack={() => router.push('/dashboard')}
      onSubmit={() => {
        alert('Maintenance request submitted successfully!');
        router.push('/dashboard');
      }}
    />
  );
}
