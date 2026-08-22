'use client';

import { useRouter } from 'next/navigation';
import { PricingPage } from '../components/PricingPage';

export default function Page() {
  const router = useRouter();

  return (
    <PricingPage
      onGetStarted={() => router.push('/login')}
      onSelectPlan={(plan) => router.push(`/register?plan=${plan.name.toLowerCase()}`)}
      onGoHome={() => router.push('/')}
      onViewContact={() => router.push('/contact')}
      onViewAbout={() => router.push('/about')}
      onViewLandlordPage={() => router.push('/for-landlords')}
      onViewTenantPage={() => router.push('/for-tenants')}
      onViewVendorPage={() => router.push('/for-vendors')}
    />
  );
}
