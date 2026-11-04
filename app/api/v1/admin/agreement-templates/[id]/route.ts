import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { updateTemplateSchema } from '@/lib/agreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

const NOT_DRAFT = {
  error: 'Only a draft can be edited. Make a new version of this template to change it.',
  code: 'NOT_DRAFT',
};

export const GET = withAuth(
  async (_req, _auth, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const template = await prisma.agreementTemplate.findUnique({
        where: { id },
        include: { jurisdiction: { select: { id: true, name: true } } },
      });
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      return NextResponse.json({ data: template });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, updateTemplateSchema);
      if (!validated.success) return validated.response;
      const { clauses, ...rest } = validated.data;

      // Edit and check the status under the same row lock, so an approval at the same moment
      // cannot be edited after the fact.
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AgreementTemplate" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.agreementTemplate.findUnique({ where: { id } });
        if (!current) return { notFound: true as const };
        if (current.status !== 'DRAFT') return { notDraft: true as const };
        const updated = await tx.agreementTemplate.update({
          where: { id },
          data: {
            ...rest,
            ...(clauses ? { clauses: clauses as unknown as Prisma.InputJsonValue } : {}),
          },
          include: { jurisdiction: { select: { id: true, name: true } } },
        });
        return { updated, current };
      });
      if ('notFound' in result) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      if ('notDraft' in result) return NextResponse.json(NOT_DRAFT, { status: 409 });

      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'AGREEMENT_TEMPLATE_UPDATED',
          entityType: 'AgreementTemplate',
          entityId: id,
          metadata: {
            key: result.current.key,
            version: result.current.version,
            fields: Object.keys(validated.data),
          } as object,
        },
      });
      return NextResponse.json({ data: result.updated });
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
      const current = await prisma.agreementTemplate.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      if (current.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only a draft can be deleted. Archive a template that has been approved.' },
          { status: 409 },
        );
      }
      await prisma.agreementTemplate.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'AGREEMENT_TEMPLATE_DELETED',
          entityType: 'AgreementTemplate',
          entityId: id,
          metadata: { key: current.key, version: current.version } as object,
        },
      });
      return NextResponse.json({ data: { id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
