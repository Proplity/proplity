'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PropertyDetail } from '../../../components/PropertyDetail';
import { PublicPropertyDetail } from '../../../components/PublicPropertyDetail';
import { navigateToPage } from '../../navigateToPage';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  if (user?.role === 'tenant') {
    return <PublicPropertyDetail propertyId={id} hideNav={true} />;
  }

  return <PropertyDetail propertyId={id} onNavigate={(page) => navigateToPage(router, page)} />;
}
