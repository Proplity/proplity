'use client';

import { useRouter } from 'next/navigation';
import { AboutPage } from '../components/AboutPage';

export default function Page() {
  const router = useRouter();

  return (
    <AboutPage
      onGoHome={() => router.push('/')}
      onGetStarted={() => router.push('/login')}
      onViewPricing={() => router.push('/pricing')}
      onViewContact={() => router.push('/contact')}
      onViewLandlordPage={() => router.push('/for-landlords')}
      onViewTenantPage={() => router.push('/for-tenants')}
      onViewVendorPage={() => router.push('/for-vendors')}
    />
  );
}
