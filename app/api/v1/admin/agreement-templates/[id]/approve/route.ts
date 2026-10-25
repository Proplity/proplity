import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { clauseProblems, type TemplateClause } from '@/lib/agreementFields';

type RouteCtx = { params: Promise<{ id: string }> };

// Approving a draft makes it the version managers use for its wording, and archives the version it
// replaces. Agreements already made keep the text they were made from.
export const POST = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AgreementTemplate" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.agreementTemplate.findUnique({ where: { id } });
        if (!current) return { error: 'Template not found', status: 404 } as const;
        if (current.status !== 'DRAFT') {
          return { error: 'Only a draft can be approved', status: 409 } as const;
        }
        const problems = clauseProblems(current.clauses as unknown as TemplateClause[]);
        if (problems.length > 0) {
          return { error: problems.join('. '), status: 422 } as const;
        }
        await tx.agreementTemplate.updateMany({
          where: { key: current.key, status: 'APPROVED', id: { not: id } },
          data: { status: 'ARCHIVED' },
        });
        const approved = await tx.agreementTemplate.update({
          where: { id },
          data: { status: 'APPROVED', approvedAt: new Date(), approvedById: session.sub },
          include: { jurisdiction: { select: { id: true, name: true } } },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'AGREEMENT_TEMPLATE_APPROVED',
            entityType: 'AgreementTemplate',
            entityId: id,
            metadata: { key: current.key, version: current.version } as object,
          },
        });
        return { approved } as const;
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ data: result.approved });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
