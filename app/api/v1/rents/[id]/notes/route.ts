import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

// Lists are capped so one busy record cannot return an unbounded response (ISS-073).
const LIST_LIMIT = 500;

type RouteCtx = { params: Promise<{ id: string }> };

// MANAGER/ADMIN only, exactly as scoped in the plan -- unlike rent access
// elsewhere, LANDLORD is deliberately not included here.
export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { select: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      // Only the property's own team reads the notes on its tenants (ISS-144).
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const notes = await prisma.note.findMany({
        take: LIST_LIMIT,
        where: { rentId: id },
        orderBy: { createdAt: 'desc' },
      });
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
      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { select: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, createNoteSchema);
      if (!validated.success) return validated.response;

      const note = await prisma.note.create({
        data: { rentId: id, authorId: session.sub, body: validated.data.body },
      });
      return NextResponse.json({ data: note }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER'] },
);
