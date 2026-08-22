'use client';

import { useRouter, useParams } from 'next/navigation';
import { PropertyDetail } from '../../../components/PropertyDetail';
import { navigateToPage } from '../../navigateToPage';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return (
    <PropertyDetail
      propertyId={Number(id)}
      onBack={() => router.push('/dashboard')}
      onNavigate={(page) => navigateToPage(router, page)}
    />
  );
}
