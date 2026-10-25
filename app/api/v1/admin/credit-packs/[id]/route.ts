import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';

type RouteCtx = { params: Promise<{ id: string }> };

// The key is fixed once created. A change reaches only purchases started afterwards: a purchase
// keeps the credits and price it was made at.
const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    credits: z.number().int('Enter whole credits').min(1).max(100_000),
    price: z.number().int('Enter whole naira').min(1).max(100_000_000),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .partial()
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one field to change',
  });

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, updateSchema);
      if (!validated.success) return validated.response;
      const current = await prisma.creditPack.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Credit pack not found' }, { status: 404 });
      const pack = await prisma.creditPack.update({ where: { id }, data: validated.data });
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, to] of Object.entries(validated.data)) {
        const from = current[k as keyof typeof current];
        if (to !== undefined && from !== to) changes[k] = { from, to };
      }
      if (Object.keys(changes).length > 0) {
        await prisma.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'CREDIT_PACK_UPDATED',
            entityType: 'CreditPack',
            entityId: id,
            metadata: { key: pack.key, changes } as object,
          },
        });
      }
      return NextResponse.json({ data: pack });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

// Purchases already made keep their own copy of the pack, so deleting is safe; switching a pack
// off is the usual way to retire one.
export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const pack = await prisma.creditPack.findUnique({ where: { id } });
      if (!pack) return NextResponse.json({ error: 'Credit pack not found' }, { status: 404 });
      await prisma.creditPack.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'CREDIT_PACK_DELETED',
          entityType: 'CreditPack',
          entityId: id,
          metadata: { key: pack.key } as object,
        },
      });
      return NextResponse.json({ data: { id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
