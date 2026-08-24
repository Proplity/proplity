'use client';

import { useRouter, useParams } from 'next/navigation';
import { PropertyApplicationForm } from '../../../../components/PropertyApplicationForm';
import { useProperty } from '@/hooks/useProperties';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: property } = useProperty(id);

  // Property has no price column (rent lives on Unit.rentAmount) -- show
  // the cheapest unit's rent, same convention as PropertyDiscovery's card.
  const cheapestUnit = property ? [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0] : undefined;
  const propertyPrice = cheapestUnit
    ? `₦${cheapestUnit.rentAmount.toLocaleString()}/${cheapestUnit.listedPaymentFrequency.toLowerCase()}`
    : '';

  return (
    <PropertyApplicationForm
      propertyId={id}
      propertyTitle={property?.name ?? ''}
      propertyPrice={propertyPrice}
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
