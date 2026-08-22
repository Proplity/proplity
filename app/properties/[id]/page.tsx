'use client';

import { useRouter, useParams } from 'next/navigation';
import { PublicPropertyDetail } from '../../components/PublicPropertyDetail';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return (
    <PublicPropertyDetail
      propertyId={Number(id)}
      onGetStarted={() => router.push('/login')}
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
