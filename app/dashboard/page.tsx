'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
