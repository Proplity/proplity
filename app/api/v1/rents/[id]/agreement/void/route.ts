import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyAndEmail } from '@/lib/notifications';
import { refundCreditsIn } from '@/lib/credits';
import { currentAgreement } from '@/lib/rentAgreement';
import { voidAgreementSchema } from '@/lib/rentAgreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

// Withdraws an agreement nobody has signed so another can be made. A draft that was never sent
// gives its credits back; one the tenant has already seen does not. A signed agreement cannot be
// withdrawn.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, voidAgreementSchema);
      if (!validated.success) return validated.response;

      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

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
        if (current.status === 'EXECUTED') {
          return {
            ok: false,
            status: 409,
            error: 'A signed agreement cannot be withdrawn',
            code: 'EXECUTED',
          } as const;
        }
        // Someone has already signed the rent itself (click-wrap), so withdrawing the agreement
        // would leave a signature that no longer matches any wording.
        if (await tx.rentSignature.count({ where: { rentId: id } })) {
          return {
            ok: false,
            status: 409,
            error: 'Someone has already signed, so this agreement cannot be withdrawn',
            code: 'HAS_SIGNATURES',
          } as const;
        }
        const refund = current.status === 'DRAFT' && current.creditsCharged > 0;
        if (refund) {
          await refundCreditsIn(
            tx,
            current.createdById ?? session.sub,
            current.creditsCharged,
            'rent_agreement',
            'Rent agreement withdrawn before it was sent',
          );
        }
        const voided = await tx.rentAgreement.update({
          where: { id: current.id },
          data: {
            status: 'VOID',
            voidedAt: new Date(),
            voidedById: session.sub,
            voidReason: validated.data.reason || null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'RENT_AGREEMENT_VOIDED',
            entityType: 'RentAgreement',
            entityId: current.id,
            metadata: { rentId: id, refunded: refund ? current.creditsCharged : 0 } as object,
          },
        });
        return {
          ok: true,
          voided,
          wasSent: current.status === 'ISSUED',
          refunded: refund ? current.creditsCharged : 0,
        } as const;
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status },
        );
      }
      if (result.wasSent) {
        await notifyAndEmail(rent.tenantId, {
          title: 'Rent agreement withdrawn',
          body: `The rent agreement for unit ${rent.unit.unitNumber} at ${rent.unit.property.name} was withdrawn. Do not sign it; a new one may follow.`,
          link: `/dashboard/tenants/${id}`,
        });
      }
      return NextResponse.json({ data: { id: result.voided.id, refunded: result.refunded } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
