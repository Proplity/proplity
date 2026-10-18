import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { validateCSRF } from '@/lib/auth/csrf';

type Handler = (
  req: NextRequest,
  ctx: { session: { sub: string; role: Role } },
  // Next passes route params as a Promise the route itself types, so this stays loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routeCtx?: any,
) => Promise<NextResponse>;

export function withAuth(handler: Handler, opts?: { roles?: Role[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, routeCtx?: any) => {
    // Cookie-authenticated writes must come from our own pages: a cross-site request
    // has a foreign Origin (or none). SameSite=Lax is the first line; this is the second.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !validateCSRF(req)) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }

    const jwtSession = await getServerSession();
    if (!jwtSession) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    // The JWT payload types `role` as a plain string (jose can't verify it
    // against the Prisma enum) — safe to narrow here since signAccessToken()
    // is only ever called with a real Role value (see lib/auth/jwt.ts).
    const session = { sub: jwtSession.sub, role: jwtSession.role as Role };

    // The token lives 15 minutes, so check the account itself: a suspended
    // person is locked out at once, and a role change applies immediately
    // instead of when the token expires (ISS-054).
    const account = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { status: true, role: true },
    });
    if (!account) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (account.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Account is suspended' }, { status: 403 });
    }
    session.role = account.role;

    if (opts?.roles && !opts.roles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, { session }, routeCtx);
  };
}
