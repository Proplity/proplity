import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account inactive or missing' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  });
}
