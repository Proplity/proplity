'use client';

import { useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { PropertyApplicationForm } from '../../../../components/PropertyApplicationForm';
import { useProperty } from '@/hooks/useProperties';
import { useAuth } from '@/context/AuthContext';
import { isTenantProfileComplete } from '@/lib/tenantProfile';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { data: property } = useProperty(id);

  // Gate on the tenant profile being complete instead of asking for the
  // same identity/vetting data again on every application -- see
  // lib/tenantProfile.ts and CompleteProfileForm.tsx. auth.user resolves
  // asynchronously (starts null), so this only fires once it's actually
  // known to be incomplete -- never on the still-loading null state.
  const profileIncomplete = !!auth.user && !isTenantProfileComplete(auth.user);
  useEffect(() => {
    if (profileIncomplete) {
      router.replace(`/dashboard/profile/complete?next=${encodeURIComponent(pathname)}`);
    }
  }, [profileIncomplete, pathname, router]);

  if (profileIncomplete) return null;

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
