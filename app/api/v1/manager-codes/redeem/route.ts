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
      if (code.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'This code is no longer active', code: 'CODE_INACTIVE' }, { status: 409 });
      }
      if (code.linkedManagerId) {
        return NextResponse.json({ error: 'This code has already been used', code: 'CODE_USED' }, { status: 409 });
      }

      const updated = await prisma.managerInviteCode.update({
        where: { id: code.id },
        data: { linkedManagerId: session.sub, linkedAt: new Date() },
        include: { landlord: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);
