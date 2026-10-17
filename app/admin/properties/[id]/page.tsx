'use client';

import { useRouter, useParams } from 'next/navigation';
import { PropertyDetail } from '@/app/components/PropertyDetail';
import { navigateToPage } from '@/app/dashboard/navigateToPage';

export default function AdminPropertyDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <PropertyDetail
        propertyId={id}
        onNavigate={(page) => {
          if (page.type === 'dashboard') {
            router.push('/admin/properties');
          } else {
            navigateToPage(router, page);
          }
        }}
      />
    </div>
  );
}
