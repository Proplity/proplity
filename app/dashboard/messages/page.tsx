'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MessagingPortal } from '../../components/MessagingPortal';

export default function Page() {
  const router = useRouter();
  const auth = useAuth();

  return (
    <MessagingPortal
      currentUserRole={auth.user?.role ?? 'tenant'}
      onBack={() => router.push('/dashboard')}
    />
  );
}
