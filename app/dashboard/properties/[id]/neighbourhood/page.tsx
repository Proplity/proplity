'use client';

import { useParams } from 'next/navigation';
import { NeighbourhoodReportEditor } from '@/app/components/NeighbourhoodReportEditor';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <NeighbourhoodReportEditor propertyId={id} />;
}
