import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ isDefault: z.literal(true) });

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const account = await prisma.bankAccount.findUnique({ where: { id } });
      if (!account || account.userId !== session.sub) {
        return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.bankAccount.updateMany({
          where: { userId: session.sub, isDefault: true },
          data: { isDefault: false },
        });
        return tx.bankAccount.update({ where: { id }, data: { isDefault: true } });
      });

      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'VENDOR'] },
);

export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const account = await prisma.bankAccount.findUnique({ where: { id } });
      if (!account || account.userId !== session.sub) {
        return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
      }

      await prisma.bankAccount.delete({ where: { id } });

      // If the deleted account was the default and other accounts remain,
      // promote the most recently added one so the user always has exactly
      // one default when they have any accounts at all.
      if (account.isDefault) {
        const next = await prisma.bankAccount.findFirst({
          where: { userId: session.sub },
          orderBy: { createdAt: 'desc' },
        });
        if (next)
          await prisma.bankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
      }

      return NextResponse.json({ data: { id, deleted: true } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'VENDOR'] },
);
