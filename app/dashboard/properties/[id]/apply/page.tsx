'use client';

import { useRouter, useParams } from 'next/navigation';
import { PropertyApplicationForm } from '../../../../components/PropertyApplicationForm';
import { mockProperties } from '../../../../store/mockData';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const property = mockProperties.find((p) => p.id === Number(id));

  return (
    <PropertyApplicationForm
      propertyId={Number(id)}
      propertyTitle={property?.title ?? ''}
      propertyPrice={property?.price ?? ''}
      onBack={() => router.push(`/dashboard/properties/${id}`)}
      onSubmit={() => {
        alert(
          'Application submitted successfully! The property manager will review your application and contact you within 24-48 hours.',
        );
        router.push('/dashboard');
      }}
    />
  );
}
