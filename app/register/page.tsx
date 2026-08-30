'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Register } from '../components/Auth/Register';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');

  // Registration no longer establishes a session directly (email
  // verification sits in between), so the old "go straight to checkout"
  // redirect can't happen here anymore -- carried through to /login instead,
  // which resumes it once the now-verified account actually logs in.
  return <Register onSwitchToLogin={() => router.push(plan ? `/login?plan=${plan}` : '/login')} />;
}

export default function Page() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
