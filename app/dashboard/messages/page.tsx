'use client';

import { useRouter } from 'next/navigation';
import { MessagingPortal } from '../../components/MessagingPortal';

export default function Page() {
  const router = useRouter();

  return <MessagingPortal onBack={() => router.push('/dashboard')} />;
}
