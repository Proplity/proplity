'use client';

import { useRouter } from 'next/navigation';
import { NeighbourhoodReport } from '../../components/NeighbourhoodReport';

export default function Page() {
  const router = useRouter();
  return <NeighbourhoodReport onBack={() => router.push('/dashboard')} />;
}
