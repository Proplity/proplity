/**
 * The app's own public base URL, for links embedded in outbound email.
 *
 * Every verification/invite/moderation email used to hardcode
 * `http://localhost:3000`, which silently produces dead links in every
 * environment except a developer's laptop -- the kind of bug that only
 * surfaces once a real user clicks one.
 *
 * Resolution order (ADR-0005):
 *   1. Outside production builds (`next dev`, tests): the incoming request's
 *      origin, so links match whatever port/host the developer is using.
 *      NEVER used in production -- the Host header is client-controlled, and
 *      a forged one would point password-reset links at an attacker's domain.
 *   2. NEXT_PUBLIC_APP_URL (when not localhost) -- set this in production.
 *      It is the only option that survives a custom domain and stays stable
 *      across deployments.
 *   3. VERCEL_PROJECT_PRODUCTION_URL on production deployments, or VERCEL_URL
 *      on preview deployments. Platform-injected, not request-derived, so
 *      still trustworthy. VERCEL_URL changes every deploy, so production
 *      never prefers it.
 *   4. A loopback (localhost / 127.0.0.1) request origin, so a local
 *      production build works on any port.
 *   5. NEXT_PUBLIC_APP_URL as given (e.g. localhost), then http://localhost:3000.
 *
 * Both Vercel vars are supplied bare (`my-app.vercel.app`, no scheme), hence
 * the prefixing below.
 */
type RequestLike = { nextUrl?: { origin?: string } } | null | undefined;

function isLocal(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

function resolveBaseUrl(req?: RequestLike): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;

  if (process.env.NODE_ENV !== 'production' && req?.nextUrl?.origin) {
    return req.nextUrl.origin;
  }

  if (explicit && !isLocal(explicit)) return explicit;

  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Self-hosted / local production build with nothing public configured: a
  // loopback request origin is safe to echo (a forged `Host: localhost` can
  // only point the link back at the recipient's own machine) and means any
  // port works without editing NEXT_PUBLIC_APP_URL.
  const origin = req?.nextUrl?.origin;
  if (origin && isLocal(origin)) return origin;

  return explicit || 'http://localhost:3000';
}

/** Base URL with any trailing slash removed, so callers can append paths. */
export function getAppUrl(req?: RequestLike): string {
  return resolveBaseUrl(req).replace(/\/+$/, '');
}

// Routes that exist both as an API endpoint and a user-facing page: emails
// must always link to the page.
const PAGE_ROUTES = ['verify-email', 'reset-password'];

/** Absolute URL for `path` (which should start with "/"). */
export function appUrl(path: string, req?: RequestLike): string {
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  for (const page of PAGE_ROUTES) {
    cleanPath = cleanPath.replace(new RegExp(`^/api/v1(?:/auth)?/${page}`), `/${page}`);
  }
  return `${getAppUrl(req)}${cleanPath}`;
}
