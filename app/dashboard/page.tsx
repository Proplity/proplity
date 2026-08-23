'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Dashboard } from '../components/Dashboard';
import { TenantDashboard } from '../components/TenantDashboard';
import { LandlordDashboard } from '../components/LandlordDashboard';
import { VendorDashboard } from '../components/VendorDashboard';
import { navigateToPage } from './navigateToPage';

export default function Page() {
  const auth = useAuth();
  const router = useRouter();
  const onNavigate = (page: Parameters<typeof navigateToPage>[1]) => navigateToPage(router, page);

  useEffect(() => {
    if (auth.user?.role === 'admin') {
      router.replace('/admin');
    }
  }, [auth.user?.role, router]);

  // AuthContext's role comes from an async client-side /me fetch -- while it's
  // in flight, auth.user is null. Falling through to the switch's default
  // case here would flash the manager dashboard for every non-manager role
  // on every reload, since `undefined` doesn't match any case below.
  if (auth.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  switch (auth.user?.role) {
    case 'tenant':
      return <TenantDashboard onNavigate={onNavigate} />;
    case 'landlord':
      return <LandlordDashboard onNavigate={onNavigate} />;
    case 'vendor':
      return <VendorDashboard onNavigate={onNavigate} />;
    default:
      return <Dashboard onNavigate={onNavigate} />;
  }
}
