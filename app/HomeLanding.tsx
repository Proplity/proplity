'use client';

import { useRouter } from 'next/navigation';
import { LandingPage } from './components/LandingPage';

export function HomeLanding() {
  const router = useRouter();

  return (
    <LandingPage
      onGetStarted={() => router.push('/login')}
      onSelectPlan={(plan) => router.push(`/register?plan=${plan.name.toLowerCase()}`)}
      onViewProperty={(propertyId) => router.push(`/properties/${propertyId}`)}
      onViewPricing={() => router.push('/pricing')}
      onViewContact={() => router.push('/contact')}
      onViewAbout={() => router.push('/about')}
      onViewLandlordPage={() => router.push('/for-landlords')}
      onViewTenantPage={() => router.push('/for-tenants')}
      onViewVendorPage={() => router.push('/for-vendors')}
    />
  );
}
