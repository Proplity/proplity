'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ScheduleViewing } from '../../../../components/ScheduleViewing';
import { api } from '@/lib/apiClient';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<{ name: string; address: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.properties
      .get(id)
      .then((res) => {
        if (!cancelled) setProperty({ name: res.data.data.name, address: res.data.data.address });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <ScheduleViewing
      propertyId={id}
      propertyTitle={property?.name ?? ''}
      propertyAddress={property?.address ?? ''}
      onBack={() => router.push(`/dashboard/properties/${id}`)}
      onSubmit={() => router.push(`/dashboard/properties/${id}`)}
    />
  );
}
