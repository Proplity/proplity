import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyAndEmail } from '@/lib/notifications';
import { getSystemSettings } from '@/lib/systemSettings';
import { currentAgreement, loadRentForAgreement, prepareGeneration } from '@/lib/rentAgreement';
import type { ClauseChoices } from '@/lib/agreementFields';

type RouteCtx = { params: Promise<{ id: string }> };

// Sends a draft to the tenant to sign. The tenant cannot see it before this. The legal rules are
// checked once more, because they may have changed since the draft was made.
export const POST = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const rent = await loadRentForAgreement(id);
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const settings = await getSystemSettings();

      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const current = await currentAgreement(id, tx);
        if (!current)
          return {
            ok: false,
            status: 404,
            error: 'This rent has no agreement',
            code: 'NO_AGREEMENT',
          } as const;
        if (current.status !== 'DRAFT' || current.source !== 'GENERATED') {
          return {
            ok: false,
            status: 409,
            error: 'Only a draft can be sent to the tenant',
            code: 'NOT_DRAFT',
          } as const;
        }
        const prepared = await prepareGeneration(
          session,
          rent,
          {
            templateId: current.templateId ?? '',
            landlordName: current.landlordName ?? undefined,
            agencyFee: current.agencyFee,
            legalFee: current.legalFee,
            choices: (current.choices ?? {}) as ClauseChoices,
          },
          settings,
          { skipUsableCheck: true },
        );
        if (!prepared.ok) return prepared;
        const issued = await tx.rentAgreement.update({
          where: { id: current.id },
          data: { status: 'ISSUED', issuedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'RENT_AGREEMENT_ISSUED',
            entityType: 'RentAgreement',
            entityId: current.id,
            metadata: { rentId: id } as object,
          },
        });
        return { ok: true, issued } as const;
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            code: result.code,
            ...('findings' in result && result.findings ? { findings: result.findings } : {}),
          },
          { status: result.status },
        );
      }

      const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
      await notifyAndEmail(rent.tenantId, {
        title: 'Rent agreement ready to sign',
        body: `The rent agreement for ${where} is ready. Read it and add your signature.`,
        link: `/dashboard/tenants/${id}`,
      });
      return NextResponse.json({ data: { id: result.issued.id, status: result.issued.status } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
