import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleFileError } from '@/lib/api/fileErrors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { parseFileUrl } from '@/lib/fileRef';
import { currentAgreement, serializeAgreement } from '@/lib/rentAgreement';
import { stampDutySchema } from '@/lib/rentAgreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

// The property team's record of stamp duty: where it stands, the reference, the amount and the
// receipt. Stamp duty is paid to the federal tax authority, not through Proplity; this only tracks it.
export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, stampDutySchema);
      if (!validated.success) return validated.response;
      const body = validated.data;

      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (body.receiptUrl) {
        if (!parseFileUrl(body.receiptUrl)) {
          return NextResponse.json(
            { error: 'Upload the receipt as a file', code: 'BAD_FILE' },
            { status: 400 },
          );
        }
        await assertOwnsFileUrls([body.receiptUrl], session.sub, 'rents');
      }

      const agreement = await currentAgreement(id);
      if (!agreement || agreement.status === 'DRAFT') {
        return NextResponse.json(
          { error: 'Stamp duty is recorded once the agreement has been sent', code: 'NOT_SENT' },
          { status: 409 },
        );
      }

      const status = body.status ?? agreement.stampDutyStatus;
      const updated = await prisma.rentAgreement.update({
        where: { id: agreement.id },
        data: {
          ...(body.status !== undefined ? { stampDutyStatus: body.status } : {}),
          ...(body.reference !== undefined ? { stampDutyReference: body.reference || null } : {}),
          ...(body.amount !== undefined ? { stampDutyAmount: body.amount } : {}),
          ...(body.receiptUrl !== undefined ? { stampDutyReceiptUrl: body.receiptUrl } : {}),
          stampedAt:
            status === 'STAMPED'
              ? (body.stampedAt ?? agreement.stampedAt ?? new Date())
              : body.stampedAt !== undefined
                ? body.stampedAt
                : status === 'NOT_STARTED' || status === 'IN_PROGRESS'
                  ? null
                  : agreement.stampedAt,
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'RENT_AGREEMENT_STAMP_DUTY_UPDATED',
          entityType: 'RentAgreement',
          entityId: agreement.id,
          metadata: { rentId: id, status, fields: Object.keys(body) } as object,
        },
      });
      return NextResponse.json({ data: serializeAgreement(updated, 'TEAM') });
    } catch (err) {
      return handleFileError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
