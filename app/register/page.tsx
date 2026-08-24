'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Register } from '../components/Auth/Register';
import { subscriptionsEnabled } from '@/lib/subscriptions';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');

  return (
    <Register
      onRegister={(role) => {
        if ((role === 'manager' || role === 'landlord') && plan && subscriptionsEnabled()) {
          router.push(`/checkout?plan=${plan}`);
        } else {
          router.push('/dashboard');
        }
      }}
      onSwitchToLogin={() => router.push('/login')}
    />
  );
}

export default function Page() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
