import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

type RouteCtx = { params: Promise<{ id: string }> };

// Starts the next version of a wording as a draft, copied from the version named. Editing an
// approved template is always done this way, so a version that was approved never changes.
export const POST = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const source = await tx.agreementTemplate.findUnique({ where: { id } });
        if (!source) return { error: 'Template not found', status: 404 } as const;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agreement-template:${source.key}`}))`;
        const versions = await tx.agreementTemplate.findMany({
          where: { key: source.key },
          select: { id: true, version: true, status: true },
        });
        const draft = versions.find((v) => v.status === 'DRAFT');
        if (draft) {
          return {
            error: 'There is already a draft of this template. Edit that one.',
            status: 409,
            code: 'DRAFT_EXISTS',
            draftId: draft.id,
          } as const;
        }
        const created = await tx.agreementTemplate.create({
          data: {
            key: source.key,
            name: source.name,
            version: Math.max(...versions.map((v) => v.version)) + 1,
            jurisdictionId: source.jurisdictionId,
            status: 'DRAFT',
            clauses: source.clauses as Prisma.InputJsonValue,
            witnessRequired: source.witnessRequired,
            notes: source.notes,
            createdById: session.sub,
          },
          include: { jurisdiction: { select: { id: true, name: true } } },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'AGREEMENT_TEMPLATE_CREATED',
            entityType: 'AgreementTemplate',
            entityId: created.id,
            metadata: {
              key: created.key,
              version: created.version,
              from: source.version,
            } as object,
          },
        });
        return { created } as const;
      });
      if ('error' in result) {
        return NextResponse.json(
          {
            error: result.error,
            ...('code' in result ? { code: result.code, draftId: result.draftId } : {}),
          },
          { status: result.status },
        );
      }
      return NextResponse.json({ data: result.created }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
