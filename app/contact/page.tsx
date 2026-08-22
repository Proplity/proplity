'use client';

import { useRouter } from 'next/navigation';
import { ContactPage } from '../components/ContactPage';

export default function Page() {
  const router = useRouter();

  return (
    <ContactPage
      onGoHome={() => router.push('/')}
      onGetStarted={() => router.push('/login')}
      onViewPricing={() => router.push('/pricing')}
      onViewLandlordPage={() => router.push('/for-landlords')}
      onViewTenantPage={() => router.push('/for-tenants')}
      onViewVendorPage={() => router.push('/for-vendors')}
    />
  );
}
