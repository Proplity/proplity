'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ListProperty } from '../../../components/ListProperty';

export default function Page() {
  const router = useRouter();
  const auth = useAuth();
  const userRole = auth.user?.role === 'landlord' ? 'landlord' : 'manager';

  return <ListProperty onBack={() => router.push('/dashboard')} userRole={userRole} />;
}
