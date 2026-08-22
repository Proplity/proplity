'use client';

import { useRouter } from 'next/navigation';
import { ServiceProviderFeaturePage } from '../components/ServiceProviderFeaturePage';

export default function Page() {
  const router = useRouter();

  return (
    <ServiceProviderFeaturePage
      onGetStarted={() => router.push('/register')}
      onGoHome={() => router.push('/')}
      onViewPricing={() => router.push('/pricing')}
      onViewContact={() => router.push('/contact')}
      onViewAbout={() => router.push('/about')}
      onViewLandlordPage={() => router.push('/for-landlords')}
      onViewTenantPage={() => router.push('/for-tenants')}
      onViewVendorPage={() => router.push('/for-vendors')}
    />
  );
}
