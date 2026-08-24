'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Login } from '../components/Auth/Login';
import { subscriptionsEnabled } from '@/lib/subscriptions';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');

  return (
    <Login
      onLogin={(role) => {
        if ((role === 'manager' || role === 'landlord') && plan && subscriptionsEnabled()) {
          router.push(`/checkout?plan=${plan}`);
          return;
        }
        router.push(role === 'admin' ? '/admin' : '/dashboard');
      }}
      onSwitchToRegister={() => router.push('/register')}
      onForgotPassword={() => router.push('/forgot-password')}
    />
  );
}

export default function Page() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
