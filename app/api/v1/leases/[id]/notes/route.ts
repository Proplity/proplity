import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

// MANAGER/ADMIN only, exactly as scoped in the plan -- unlike lease access
// elsewhere, LANDLORD is deliberately not included here.
export const GET = withAuth(
  async (_req, _session, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const lease = await prisma.lease.findUnique({ where: { id } });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

      const notes = await prisma.note.findMany({ where: { leaseId: id }, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ data: notes });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER'] },
);

const createNoteSchema = z.object({ body: z.string().min(1) });

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const lease = await prisma.lease.findUnique({ where: { id } });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

      const validated = await validateBody(req, createNoteSchema);
      if (!validated.success) return validated.response;

      const note = await prisma.note.create({
        data: { leaseId: id, authorId: session.sub, body: validated.data.body },
      });
      return NextResponse.json({ data: note }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER'] },
);
