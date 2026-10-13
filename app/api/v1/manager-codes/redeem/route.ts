import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

const redeemSchema = z.object({ code: z.string().min(1) });

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, redeemSchema);
      if (!validated.success) return validated.response;

      const code = await prisma.managerInviteCode.findUnique({
        where: { code: validated.data.code.trim().toUpperCase() },
      });
      if (!code) return NextResponse.json({ error: 'Invalid code' }, { status: 404 });

      // The claim itself is a single atomic write, NOT a read-then-write.
      // `status`/`linkedManagerId` are part of the WHERE, so the database --
      // not this process -- decides who wins: exactly one of two concurrent
      // redemptions of the same code matches an unclaimed row and reports
      // count 1; the loser matches nothing and is correctly told the code is
      // taken. The same pattern guards refresh-token rotation (see
      // /api/v1/auth/refresh), for the same reason.
      //
      // The checks below are still read from `code` for their *error
      // messages* only -- they distinguish "revoked" from "already claimed"
      // for the user, and are never what authorizes the write.
      const claimed = await prisma.managerInviteCode.updateMany({
        where: { id: code.id, status: 'ACTIVE', linkedManagerId: null },
        data: { linkedManagerId: session.sub, linkedAt: new Date() },
      });

      if (claimed.count === 0) {
        // Re-read rather than trusting the pre-write snapshot: the row may
        // have been claimed in the microseconds since, and the caller
        // deserves the reason it actually failed now.
        const current = await prisma.managerInviteCode.findUnique({ where: { id: code.id } });
        if (current && current.status !== 'ACTIVE') {
          return NextResponse.json(
            { error: 'This code is no longer active', code: 'CODE_INACTIVE' },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: 'This code has already been used', code: 'CODE_USED' },
          { status: 409 },
        );
      }

      const updated = await prisma.managerInviteCode.findUnique({
        where: { id: code.id },
        include: { landlord: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);
