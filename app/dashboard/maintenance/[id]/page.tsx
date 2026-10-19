'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MaintenanceDetail } from '../../../components/MaintenanceDetail';

// This page is the property team's view of a repair. Notification links from before the tenant and
// vendor had their own screens still point here, so a tenant or vendor is sent to theirs.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;

  useEffect(() => {
    if (role === 'tenant') router.replace(`/dashboard/tenant-maintenance?request=${id}`);
    else if (role === 'vendor') router.replace(`/dashboard/vendor/jobs/${id}`);
  }, [role, id, router]);

  if (role === 'tenant' || role === 'vendor') {
    return <div className="p-6 text-sm text-gray-500">Opening your repair…</div>;
  }
  return <MaintenanceDetail requestId={id} />;
}
