import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { ensureDefaultAgreementData } from '@/lib/agreements';
import { createTemplateSchema } from '@/lib/agreementSchema';

export const GET = withAuth(
  async () => {
    try {
      await ensureDefaultAgreementData();
      const templates = await prisma.agreementTemplate.findMany({
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
        include: { jurisdiction: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ data: templates });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createTemplateSchema);
      if (!validated.success) return validated.response;
      const { clauses, ...data } = validated.data;

      await ensureDefaultAgreementData();
      const jurisdiction = await prisma.jurisdiction.findUnique({
        where: { id: data.jurisdictionId },
      });
      if (!jurisdiction) {
        return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 });
      }
      if (await prisma.agreementTemplate.findFirst({ where: { key: data.key } })) {
        return NextResponse.json(
          {
            error: 'A template with that key already exists. Make a new version of it instead.',
            code: 'KEY_IN_USE',
          },
          { status: 409 },
        );
      }
      const created = await prisma.agreementTemplate.create({
        data: {
          ...data,
          clauses: clauses as unknown as Prisma.InputJsonValue,
          version: 1,
          status: 'DRAFT',
          createdById: session.sub,
        },
        include: { jurisdiction: { select: { id: true, name: true } } },
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'AGREEMENT_TEMPLATE_CREATED',
          entityType: 'AgreementTemplate',
          entityId: created.id,
          metadata: { key: created.key, version: 1 } as object,
        },
      });
      return NextResponse.json({ data: created }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
