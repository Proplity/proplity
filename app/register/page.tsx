'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Register } from '../components/Auth/Register';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');

  return (
    <Register
      onRegister={(role) => {
        if ((role === 'manager' || role === 'landlord') && plan) {
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
