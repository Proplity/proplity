'use client';

import { useRouter, useParams } from 'next/navigation';
import { ScheduleViewing } from '../../../../components/ScheduleViewing';
import { mockProperties } from '../../../../store/mockData';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const property = mockProperties.find((p) => p.id === Number(id));

  return (
    <ScheduleViewing
      propertyId={Number(id)}
      propertyTitle={property?.title ?? ''}
      propertyAddress={property?.location ?? ''}
      onBack={() => router.push(`/dashboard/properties/${id}`)}
      onSubmit={() => router.push(`/dashboard/properties/${id}`)}
    />
  );
}
