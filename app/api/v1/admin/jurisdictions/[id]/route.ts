import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { updateJurisdictionSchema } from '@/lib/agreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, updateJurisdictionSchema);
      if (!validated.success) return validated.response;
      const data = validated.data;

      const current = await prisma.jurisdiction.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 });
      if (current.isDefault && data.isDefault === false) {
        return NextResponse.json(
          { error: 'Make another jurisdiction the default instead; there should always be one' },
          { status: 400 },
        );
      }
      if (current.isDefault && data.isActive === false) {
        return NextResponse.json(
          { error: 'The default jurisdiction has to stay active' },
          { status: 400 },
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.jurisdiction.updateMany({
            where: { id: { not: id } },
            data: { isDefault: false },
          });
        }
        return tx.jurisdiction.update({ where: { id }, data });
      });

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, to] of Object.entries(data)) {
        const from = current[k as keyof typeof current];
        if (to !== undefined && JSON.stringify(from) !== JSON.stringify(to))
          changes[k] = { from, to };
      }
      if (Object.keys(changes).length > 0) {
        await prisma.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'JURISDICTION_UPDATED',
            entityType: 'Jurisdiction',
            entityId: id,
            metadata: { key: current.key, changes } as object,
          },
        });
      }
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const current = await prisma.jurisdiction.findUnique({
        where: { id },
        include: { _count: { select: { templates: true } } },
      });
      if (!current) return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 });
      if (current.isDefault) {
        return NextResponse.json(
          { error: 'The default jurisdiction cannot be deleted' },
          { status: 400 },
        );
      }
      if (current._count.templates > 0) {
        return NextResponse.json(
          {
            error: 'It has agreement templates. Switch it off instead of deleting it.',
            code: 'IN_USE',
          },
          { status: 409 },
        );
      }
      await prisma.jurisdiction.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'JURISDICTION_DELETED',
          entityType: 'Jurisdiction',
          entityId: id,
          metadata: { key: current.key, name: current.name } as object,
        },
      });
      return NextResponse.json({ data: { id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
