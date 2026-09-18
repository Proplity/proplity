'use client';

import { useParams } from 'next/navigation';
import { PublicPropertyDetail } from '../../components/PublicPropertyDetail';

export default function Page() {
  const { id } = useParams<{ id: string }>();

  return <PublicPropertyDetail propertyId={id} />;
}
