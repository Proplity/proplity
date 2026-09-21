'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LandingPage } from './components/LandingPage';
import { useAuth } from '@/context/AuthContext';
import { safeRedirect } from '@/lib/safeRedirect';

// proxy.ts only ever inspects the short-lived access_token cookie, so a
// page reload after 15+ minutes idle (access token expired, refresh token
// still good) gets bounced here with `?from=` before the browser ever gets
// a chance to silently refresh. AuthContext's own fetchUser already retries
// through /api/v1/auth/refresh on mount -- once that resolves `user`, send
// the visitor back to where they actually meant to go instead of stranding
// them on the landing page.
function FromRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading || !user) return;
    const from = safeRedirect(searchParams.get('from'));
    if (from) router.replace(from);
  }, [loading, user, searchParams, router]);

  return null;
}

export function HomeLanding() {
  return (
    <>
      <Suspense fallback={null}>
        <FromRedirect />
      </Suspense>
      <LandingPage />
    </>
  );
}
