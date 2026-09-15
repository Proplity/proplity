'use client';

import { useParams } from 'next/navigation';
import { AdminBreakdownPage, AdminBreakdownType } from '../../../components/AdminBreakdownPage';

export default function Page() {
  const { type } = useParams<{ type: string }>();

  return <AdminBreakdownPage breakdownType={type as AdminBreakdownType} />;
}
