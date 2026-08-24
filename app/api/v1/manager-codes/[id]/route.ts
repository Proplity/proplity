import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ status: z.enum(['ACTIVE', 'DEACTIVATED']) });

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const code = await prisma.managerInviteCode.findUnique({ where: { id } });
      if (!code) return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      if (code.landlordId !== session.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;

      const updated = await prisma.managerInviteCode.update({
        where: { id },
        data: { status: validated.data.status },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['LANDLORD'] },
);
