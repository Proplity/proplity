import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { validateCSRF } from '@/lib/auth/csrf';
import { validateBody } from '@/lib/api/validate';
import { prisma } from '@/lib/db';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  phoneNumber: true,
  bio: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

function serialize(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phoneNumber: string | null;
  bio: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.toLowerCase(),
    status: user.status,
    phoneNumber: user.phoneNumber,
    bio: user.bio,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: PROFILE_SELECT,
  });

  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account inactive or missing' }, { status: 401 });
  }

  return NextResponse.json({ user: serialize(user) });
}

// Deliberately narrow: name/phoneNumber/bio only. No email (a real "change
// email" flow needs its own re-verification step, not a side effect of
// this route), no role/status (privilege fields -- ADMIN-only elsewhere,
// never self-service), no avatarUrl (no file-storage endpoint exists
// anywhere in this codebase to upload one to).
const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phoneNumber: z.string().max(32).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const validated = await validateBody(req, updateProfileSchema);
  if (!validated.success) return validated.response;

  if (Object.keys(validated.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.sub },
    data: validated.data,
    select: PROFILE_SELECT,
  });

  return NextResponse.json({ user: serialize(user) });
}
