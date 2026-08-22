import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { Role } from '@prisma/client';

type Handler = (
  req: NextRequest,
  ctx: { session: { sub: string; role: Role } },
  routeCtx?: any,
) => Promise<NextResponse>;

export function withAuth(handler: Handler, opts?: { roles?: Role[] }) {
  return async (req: NextRequest, routeCtx?: any) => {
    const jwtSession = await getServerSession();
    if (!jwtSession) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    // The JWT payload types `role` as a plain string (jose can't verify it
    // against the Prisma enum) — safe to narrow here since signAccessToken()
    // is only ever called with a real Role value (see lib/auth/jwt.ts).
    const session = { sub: jwtSession.sub, role: jwtSession.role as Role };

    if (opts?.roles && !opts.roles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, { session }, routeCtx);
  };
}
