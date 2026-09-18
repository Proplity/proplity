'use client';

import { useParams } from 'next/navigation';
import { PropertyApplicationForm } from '../../../../components/PropertyApplicationForm';
import { useProperty } from '@/hooks/useProperties';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { data: property } = useProperty(id);

  // Property has no price column (rent lives on Unit.rentAmount) -- show
  // the cheapest unit's rent, same convention as PropertyDiscovery's card.
  // Application is scoped to a Unit, not a Property -- most listings have
  // exactly one unit (same assumption AddTenantForm already makes), so the
  // vacant one (or the cheapest, if none are vacant) is applied to
  // directly rather than adding a unit-picker step this flow never had.
  const cheapestUnit = property
    ? [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0]
    : undefined;
  const targetUnit = property
    ? (property.units.find((u) => u.status === 'VACANT') ?? cheapestUnit)
    : undefined;
  const propertyPrice = cheapestUnit
    ? `₦${cheapestUnit.rentAmount.toLocaleString()}/${cheapestUnit.listedPaymentFrequency.toLowerCase()}`
    : '';

  if (property && !targetUnit) {
    return <div className="p-6 text-gray-500">This property has no units to apply for.</div>;
  }

  return (
    <PropertyApplicationForm
      propertyId={id}
      unitId={targetUnit?.id ?? ''}
      propertyTitle={property?.name ?? ''}
      propertyPrice={propertyPrice}
    />
  );
}
