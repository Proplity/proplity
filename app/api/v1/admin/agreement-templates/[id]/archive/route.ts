import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

type RouteCtx = { params: Promise<{ id: string }> };

// Retires a version. Agreements already made from it are unaffected; managers can no longer start
// new ones from it.
export const POST = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const current = await prisma.agreementTemplate.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      if (current.status === 'ARCHIVED') {
        return NextResponse.json({ error: 'Already archived' }, { status: 409 });
      }
      const archived = await prisma.agreementTemplate.update({
        where: { id },
        data: { status: 'ARCHIVED' },
        include: { jurisdiction: { select: { id: true, name: true } } },
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'AGREEMENT_TEMPLATE_ARCHIVED',
          entityType: 'AgreementTemplate',
          entityId: id,
          metadata: { key: current.key, version: current.version } as object,
        },
      });
      return NextResponse.json({ data: archived });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
