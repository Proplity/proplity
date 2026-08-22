'use client';

import { useRouter, useParams } from 'next/navigation';
import { VendorJobDetail } from '../../../../components/VendorJobDetail';
import { navigateToPage } from '../../../navigateToPage';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return (
    <VendorJobDetail
      jobId={id}
      onBack={() => router.push('/dashboard')}
      onNavigate={(page) => navigateToPage(router, page)}
    />
  );
}
