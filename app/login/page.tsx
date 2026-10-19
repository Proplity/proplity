'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Login } from '../components/Auth/Login';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { setupRedirectEnabled } from '@/lib/setup';
import { safeRedirect } from '@/lib/safeRedirect';

// A visitor sent here to apply or book a viewing may need to create an account and
// verify an email first, which leaves this page. Remember where they were going for
// the rest of the tab session so the eventual sign-in still takes them there.
const POST_LOGIN_KEY = 'proplity:post-login';

function rememberedDestination(): string | null {
  try {
    return safeRedirect(window.sessionStorage.getItem(POST_LOGIN_KEY));
  } catch {
    return null;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const fromParam = safeRedirect(searchParams.get('from'));

  useEffect(() => {
    if (!fromParam) return;
    try {
      window.sessionStorage.setItem(POST_LOGIN_KEY, fromParam);
    } catch {
      // storage can be blocked; the plain ?from= still works for this sign-in
    }
  }, [fromParam]);

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
        const from = fromParam ?? rememberedDestination();
        try {
          window.sessionStorage.removeItem(POST_LOGIN_KEY);
        } catch {
          // nothing stored, nothing to clear
        }
        if (from && role !== 'admin') {
          router.push(from);
          return;
        }
        router.push(role === 'admin' ? '/admin' : '/dashboard');
      }}
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
