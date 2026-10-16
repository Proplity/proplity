'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Register } from '../components/Auth/Register';

function RegisterContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const role = searchParams.get('role');
  const code = searchParams.get('code');

  // Registration no longer establishes a session directly (email
  // verification sits in between), so the old "go straight to checkout"
  // redirect can't happen here anymore -- carried through to /login instead,
  // which resumes it once the now-verified account actually logs in.
  return (
    <Register
      loginHref={plan ? `/login?plan=${plan}` : '/login'}
      initialRole={role || undefined}
      initialCode={code || undefined}
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
