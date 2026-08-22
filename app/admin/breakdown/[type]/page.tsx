'use client';

import { useRouter, useParams } from 'next/navigation';
import { AdminBreakdownPage, AdminBreakdownType } from '../../../components/AdminBreakdownPage';

export default function Page() {
  const router = useRouter();
  const { type } = useParams<{ type: string }>();

  return (
    <AdminBreakdownPage
      breakdownType={type as AdminBreakdownType}
      onBack={() => router.push('/admin')}
    />
  );
}
