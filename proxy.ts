import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import {
  adminUrlFor,
  hostMode,
  isAdminApi,
  isAdminPage,
  isGeneralLoginApi,
  isStaticPath,
} from '@/lib/adminHost';

// /receipts and /agreements are open to every signed-in role; the API decides whose they are.
const PROTECTED_ROUTES = ['/dashboard', '/admin', '/receipts', '/agreements'];

// The admin sign-in page itself: reachable without a session.
const ADMIN_LOGIN = '/admin/login';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const mode = hostMode(req);

  // With ADMIN_HOST set (lib/adminHost.ts) the admin area has a host of its own.
  if (mode === 'admin') {
    if (isStaticPath(pathname)) return NextResponse.next();
    // The general sign-in does not exist here: nobody but an admin signs in on this host.
    if (isGeneralLoginApi(pathname)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // The APIs are shared; withAuth only honours an admin's session on this host.
    if (pathname.startsWith('/api/')) return NextResponse.next();
    // Every page here is the admin area: send anything else (including "/") to it.
    if (!isAdminPage(pathname)) return NextResponse.redirect(new URL('/admin', req.url));
  } else if (mode === 'public') {
    // The admin area is not served on the public host. A page link (an old bookmark, an email)
    // is forwarded to the right place; the admin APIs are simply not there.
    if (isAdminPage(pathname)) {
      return NextResponse.redirect(adminUrlFor(req, pathname + req.nextUrl.search));
    }
    if (isAdminApi(pathname)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  if (!PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (pathname === ADMIN_LOGIN) return NextResponse.next();

  const token = req.cookies.get('access_token')?.value;
  const payload = token ? await verifyToken(token) : null;
  const toAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  if (!payload) {
    // Admins sign in on their own page; everyone else on the home page.
    const loginUrl = new URL(toAdmin ? ADMIN_LOGIN : '/', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (toAdmin && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // The dashboard chrome has no tab set for admins (they have their own
  // /admin area), so rendering it for one crashes -- send them home instead.
  if (pathname.startsWith('/dashboard') && payload.role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

// Everything except Next's own assets: with an admin host configured the proxy has to see every
// page and API path to keep the two sides apart. Without one it returns at once for any path
// that is not protected.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
