// Where the admin area may be reached.
//
// ADMIN_HOST (server env, e.g. `admin.proplity.com`, or `admin.staging.proplity.com` on staging)
// puts the admin area on a host of its own:
//
//   - on that host only an admin can sign in, and only the admin area is served;
//   - on every other host an admin cannot sign in and the admin area is not served.
//
// Unset (local dev, tests, the free *.vercel.app domain), there is one host and the admin area
// lives at /admin on it. The admin sign-in page is /admin/login in both cases, and an admin never
// signs in through the general /login (see lib/auth/loginFlow.ts).
//
// Session cookies are host-only (lib/auth/cookies.ts sets no Domain), so a session made on the
// admin host is never sent to the public host and the other way round. Never add a Domain
// attribute to them: that would hand the admin session to every subdomain.

import type { NextRequest } from 'next/server';

type HostLike = { headers: Headers } | NextRequest;

/** `https://Admin.Example.com:443/x` or `admin.example.com:3000` -> `admin.example.com`. */
export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  let host = value.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0] ?? '';
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  return host || null;
}

/** The configured admin host, or null when the admin area shares the public host. */
export function adminHost(): string | null {
  return normalizeHost(process.env.ADMIN_HOST);
}

/** The host the request was addressed to. Vercel overwrites x-forwarded-host; same rule as CSRF. */
export function requestHost(req: HostLike): string | null {
  return normalizeHost(req.headers.get('x-forwarded-host') || req.headers.get('host'));
}

export type HostMode = 'shared' | 'admin' | 'public';

/**
 * `shared`: no admin host configured, anything goes.
 * `admin`: the request is for the admin host.
 * `public`: an admin host is configured and this request is for some other host.
 */
export function hostMode(req: HostLike): HostMode {
  const configured = adminHost();
  if (!configured) return 'shared';
  return requestHost(req) === configured ? 'admin' : 'public';
}

/** May this role be signed in on the host the request came to? */
export function roleAllowedOnHost(role: string, req: HostLike): boolean {
  const mode = hostMode(req);
  if (mode === 'shared') return true;
  return mode === 'admin' ? role === 'ADMIN' : role !== 'ADMIN';
}

/** Pages and files that exist on the admin host besides /admin itself. */
const ADMIN_HOST_STATIC = [
  '/_next',
  '/favicon.ico',
  '/icons',
  '/sw.js',
  '/manifest',
  '/robots.txt',
  '/images',
];

export function isStaticPath(pathname: string): boolean {
  return ADMIN_HOST_STATIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdminPage(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** `/api/v1/admin/...` and the admin sign-in. */
export function isAdminApi(pathname: string): boolean {
  return (
    pathname === '/api/v1/admin' ||
    pathname.startsWith('/api/v1/admin/') ||
    pathname === '/api/v1/auth/admin/login'
  );
}

/** The general sign-in endpoint, which the admin host must not offer. */
export function isGeneralLoginApi(pathname: string): boolean {
  return pathname === '/api/v1/auth/login';
}

/**
 * An absolute URL for an admin path. With an admin host it points there, otherwise it stays on
 * the host that is serving the request. `protocol` is `https:` unless the request was plain http
 * (local development).
 */
export function adminUrl(path: string, protocol = 'https:'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const configured = adminHost();
  return configured ? `${protocol}//${configured}${clean}` : clean;
}

/**
 * Same, for a link built while answering a request: keeps that request's scheme and port, so it
 * also works on `admin.localhost:3000` in development.
 */
export function adminUrlFor(req: NextRequest, path: string): string {
  const configured = adminHost();
  if (!configured) return path.startsWith('/') ? path : `/${path}`;
  const url = req.nextUrl.clone();
  url.hostname = configured;
  const [pathname = '/', search = ''] = path.split('?');
  url.pathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  url.search = search ? `?${search}` : '';
  return url.toString();
}
