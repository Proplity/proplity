'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Login } from '../components/Auth/Login';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { setupRedirectEnabled } from '@/lib/setup';

// Only ever a same-origin relative path we generated ourselves (e.g. from
// PublicPropertyDetail's goOrRequireLogin) -- reject anything that could
// send the browser off-site (a `//host` or `https://host` value smuggled
// into the query string) before it's ever passed to router.push.
function safeRedirect(from: string | null): string | null {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return null;
  return from;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const from = safeRedirect(searchParams.get('from'));

  useEffect(() => {
    if (!setupRedirectEnabled()) return;
    let cancelled = false;
    fetch('/api/v1/setup')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.setupComplete === false) {
          router.replace('/setup');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Login
      onLogin={(role) => {
        if ((role === 'manager' || role === 'landlord') && plan && subscriptionsEnabled()) {
          router.push(`/checkout?plan=${plan}`);
          return;
        }
        // Admins have no use for a tenant/manager deep link like a
        // schedule-viewing or apply page -- send them to their own area.
        if (from && role !== 'admin') {
          router.push(from);
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
