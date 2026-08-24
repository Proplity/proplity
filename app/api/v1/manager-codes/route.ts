import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const codes = await prisma.managerInviteCode.findMany({
        where: { landlordId: session.sub },
        include: { linkedManager: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ data: codes });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['LANDLORD'] },
);

// Same LLD-XXXX-XX shape LandlordDashboard.tsx's local generateCode() already
// used before this route existed -- kept identical so the UI's display
// format doesn't need to change, only where the code comes from.
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LLD-${part(4)}-${part(2)}`;
}

export const POST = withAuth(
  async (_req, { session }) => {
    try {
      // Vanishingly unlikely to collide (code has no DB-level retry loop
      // elsewhere in the codebase either, e.g. AccessCode's own code field),
      // but code is @unique -- retry once on the rare conflict.
      try {
        const created = await prisma.managerInviteCode.create({
          data: { code: generateCode(), landlordId: session.sub },
        });
        return NextResponse.json({ data: created }, { status: 201 });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const retried = await prisma.managerInviteCode.create({
            data: { code: generateCode(), landlordId: session.sub },
          });
          return NextResponse.json({ data: retried }, { status: 201 });
        }
        throw err;
      }
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['LANDLORD'] },
);
