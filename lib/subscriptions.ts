// Single source of truth for whether real subscription billing is turned
// on. NEXT_PUBLIC_ so the same check works both server-side (gating the
// checkout route -- the real safety net, since a client bypass can't skip
// a server-side 503) and client-side (hiding paid-tier CTAs, showing
// "Coming Soon" instead). Defaults to disabled/unset -- no one gets charged
// until this is explicitly turned on.
export function subscriptionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
}
