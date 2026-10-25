import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { getClientIp } from '@/lib/auth/rateLimit';
import { notifyPropertyTeam } from '@/lib/notifications';
import { getSystemSettings } from '@/lib/systemSettings';
import { activateRentAfterSigning } from '@/lib/rentLifecycle';
import { currentAgreement } from '@/lib/rentAgreement';
import { confirmAgreementSchema } from '@/lib/rentAgreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

// The tenant confirms an agreement their landlord uploaded: a typed full name recorded with the
// time and address, the same click-wrap signature the rest of Proplity uses. The file the landlord
// uploaded becomes the rent's signed agreement. Generated agreements are signed with POST
// /rents/[id]/sign instead.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, confirmAgreementSchema);
      if (!validated.success) return validated.response;

      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!rent || rent.tenantId !== session.sub) {
        return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      }
      const settings = await getSystemSettings();
      const ip = getClientIp(req);

      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const agreement = await currentAgreement(id, tx);
        if (!agreement || agreement.source !== 'UPLOADED' || agreement.status !== 'ISSUED') {
          return {
            ok: false,
            status: 409,
            error: 'There is no uploaded agreement waiting for your confirmation',
            code: 'NOTHING_TO_CONFIRM',
          } as const;
        }
        const now = new Date();
        await tx.rentSignature.create({
          data: {
            rentId: id,
            signerId: session.sub,
            signerRole: 'TENANT',
            fullNameTyped: validated.data.fullName,
            ipAddress: ip,
          },
        });
        await tx.rent.update({
          where: { id },
          data: { agreementSignedAt: now, signedAgreementUrl: agreement.fileUrl },
        });
        const executed = await tx.rentAgreement.update({
          where: { id: agreement.id },
          data: {
            status: 'EXECUTED',
            executedAt: now,
            confirmedAt: now,
            confirmedName: validated.data.fullName,
            confirmedIp: ip,
          },
        });
        const activation =
          settings.rentActivationRule === 'AFTER_BOTH_SIGN'
            ? await activateRentAfterSigning(tx, id)
            : 'NOT_PENDING';
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'RENT_AGREEMENT_CONFIRMED',
            entityType: 'RentAgreement',
            entityId: agreement.id,
            metadata: { rentId: id, activation } as object,
          },
        });
        return { ok: true, executed, activation } as const;
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status },
        );
      }

      await notifyPropertyTeam(
        rent.unit.property,
        {
          title: 'Tenant confirmed the rent agreement',
          body: `${validated.data.fullName} confirmed the agreement for unit ${rent.unit.unitNumber} at ${rent.unit.property.name}.`,
          link: `/dashboard/tenants/${id}`,
        },
        { email: false },
      );
      return NextResponse.json({
        data: {
          id: result.executed.id,
          status: result.executed.status,
          activation: result.activation,
        },
      });
    } catch (err) {
      // The unique (rent, signer) key: a second confirmation at the same moment.
      if ((err as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          { error: 'You have already signed this rent', code: 'ALREADY_SIGNED' },
          { status: 409 },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
