'use client';

import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ListProperty } from '../../../components/ListProperty';

export default function Page() {
  const router = useRouter();
  const auth = useAuth();

  // Same reasoning as app/dashboard/page.tsx -- don't guess 'manager' while
  // the session is still loading, or a landlord briefly sees manager copy.
  if (auth.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const userRole = auth.user?.role === 'landlord' ? 'landlord' : 'manager';

  return <ListProperty onBack={() => router.push('/dashboard')} userRole={userRole} />;
}
