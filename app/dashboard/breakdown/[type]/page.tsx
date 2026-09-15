'use client';

import { useRouter, useParams } from 'next/navigation';
import { DashboardBreakdownPage, BreakdownType } from '../../../components/DashboardBreakdownPage';
import { navigateToPage } from '../../navigateToPage';

export default function Page() {
  const router = useRouter();
  const { type } = useParams<{ type: string }>();

  return (
    <DashboardBreakdownPage
      breakdownType={type as BreakdownType}
      onNavigate={(page) => navigateToPage(router, page)}
    />
  );
}
