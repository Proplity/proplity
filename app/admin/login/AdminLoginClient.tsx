'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AdminLogin } from '@/app/components/Auth/AdminLogin';
import { safeRedirect } from '@/lib/safeRedirect';

function Inner() {
  const searchParams = useSearchParams();
  // Only back into the admin area: a ?from= pointing anywhere else is ignored.
  const from = safeRedirect(searchParams.get('from'));
  const destination = from && (from === '/admin' || from.startsWith('/admin/')) ? from : '/admin';

  return (
    <AdminLogin
      onSignedIn={() => {
        // A full navigation, so the new session cookie is what the admin pages are rendered with.
        window.location.assign(destination);
      }}
    />
  );
}

export function AdminLoginClient() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
