'use client';

import { useEffect } from 'react';

export function useAuthRefresh(isAuthenticated: boolean) {
  useEffect(() => {
    // Don't run the refresh timer when the user isn't logged in
    if (!isAuthenticated) return;

    // Fire ~2 minutes before the 15-minute access token expires
    const INTERVAL_MS = 13 * 60 * 1000;

    const performSilentRefresh = async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', { method: 'POST' });
        if (res.ok) return;

        // Verify session before redirecting to avoid cross-tab logout races
        const check = await fetch('/api/v1/auth/me');
        if (!check.ok) {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      } catch {
        // Network hiccup — let next interval retry
      }
    };

    const timer = setInterval(performSilentRefresh, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated]);
}
