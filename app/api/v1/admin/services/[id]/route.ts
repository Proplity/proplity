import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';

type RouteCtx = { params: Promise<{ id: string }> };

// The key is fixed once created: other features refer to the service by it.
const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).nullable(),
    creditCost: z.number().int('Enter whole credits').min(0).max(100_000),
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
      const current = await prisma.paidService.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      const service = await prisma.paidService.update({ where: { id }, data: validated.data });
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, to] of Object.entries(validated.data)) {
        const from = current[k as keyof typeof current];
        if (to !== undefined && from !== to) changes[k] = { from, to };
      }
      if (Object.keys(changes).length > 0) {
        await prisma.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'SERVICE_UPDATED',
            entityType: 'PaidService',
            entityId: id,
            metadata: { key: service.key, changes } as object,
          },
        });
      }
      return NextResponse.json({ data: service });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

// A service people have already paid for stays in the credit history by key, so deleting is safe;
// switching it off is the usual way to retire one.
export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const service = await prisma.paidService.findUnique({ where: { id } });
      if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      await prisma.paidService.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'SERVICE_DELETED',
          entityType: 'PaidService',
          entityId: id,
          metadata: { key: service.key } as object,
        },
      });
      return NextResponse.json({ data: { id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
