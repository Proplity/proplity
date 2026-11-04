import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { listJurisdictions } from '@/lib/agreements';
import { createJurisdictionSchema } from '@/lib/agreementSchema';

export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await listJurisdictions({ includeInactive: true }) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createJurisdictionSchema);
      if (!validated.success) return validated.response;
      const data = validated.data;

      // Seed the first set before adding, so a new row never lands alone in an empty table.
      await listJurisdictions({ includeInactive: true });
      if (await prisma.jurisdiction.findUnique({ where: { key: data.key } })) {
        return NextResponse.json(
          { error: 'A jurisdiction with that key already exists', code: 'KEY_IN_USE' },
          { status: 409 },
        );
      }
      const created = await prisma.$transaction(async (tx) => {
        if (data.isDefault) await tx.jurisdiction.updateMany({ data: { isDefault: false } });
        return tx.jurisdiction.create({ data });
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'JURISDICTION_CREATED',
          entityType: 'Jurisdiction',
          entityId: created.id,
          metadata: { key: created.key, name: created.name } as object,
        },
      });
      return NextResponse.json({ data: created }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
