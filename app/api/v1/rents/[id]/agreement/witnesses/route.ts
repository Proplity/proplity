import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { emailSchema } from '@/lib/auth/email';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/systemSettings';
import { currentAgreement, loadRentForAgreement } from '@/lib/rentAgreement';
import {
  WITNESS_MAX_SENDS,
  newWitnessToken,
  serializeWitness,
  witnessEmail,
  witnessLinkExpiry,
} from '@/lib/agreementWitness';

type RouteCtx = { params: Promise<{ id: string }> };

const inviteSchema = z
  .object({
    side: z.enum(['LANDLORD', 'TENANT']),
    name: z.string().trim().min(1, "Type the witness's full name").max(120),
    email: emailSchema,
    address: z.string().trim().max(300).optional(),
  })
  .strict();

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

/**
 * Sends a witness the emailed link to sign (or sends it again, which ends the old link). The
 * property team can ask a witness for either side; the tenant can ask only their own. A witness
 * cannot be one of the people signing, and a side's witness who has signed cannot be replaced.
 */
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, inviteSchema);
      if (!validated.success) return validated.response;
      const body = validated.data;

      const settings = await getSystemSettings();
      if (!settings.witnessEsignEnabled) {
        return fail(403, 'WITNESS_ESIGN_OFF', 'Witnesses signing by email is switched off');
      }

      const rent = await loadRentForAgreement(id);
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      const isTenant = session.role === 'TENANT' && rent.tenantId === session.sub;
      const isTeam = session.role !== 'TENANT' && canManageProperty(session, rent.unit.property);
      if (!isTenant && !isTeam) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (isTenant && body.side !== 'TENANT') {
        return fail(403, 'NOT_YOUR_WITNESS', "Only the property team asks the landlord's witness");
      }

      const property = rent.unit.property;
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const agreement = await currentAgreement(id, tx);
        if (!agreement || agreement.source !== 'GENERATED') {
          return {
            ok: false,
            status: 409,
            code: 'NO_AGREEMENT',
            error: 'There is no generated agreement to witness',
          } as const;
        }
        if (agreement.status !== 'ISSUED' && agreement.status !== 'EXECUTED') {
          return {
            ok: false,
            status: 409,
            code: 'AGREEMENT_NOT_SENT',
            error: 'Send the agreement to the tenant before asking for witnesses',
          } as const;
        }
        if (!agreement.witnessRequired) {
          return {
            ok: false,
            status: 409,
            code: 'WITNESS_NOT_REQUIRED',
            error: 'This agreement does not need witnesses',
          } as const;
        }

        const email = body.email.toLowerCase();
        // The people signing cannot witness themselves, and one person cannot witness both sides.
        const parties = await tx.user.findMany({
          where: {
            id: {
              in: [rent.tenantId, property.landlordId, property.managerId].filter(
                (x): x is string => !!x,
              ),
            },
          },
          select: { email: true },
        });
        if (parties.some((p) => p.email.toLowerCase() === email)) {
          return {
            ok: false,
            status: 400,
            code: 'WITNESS_IS_PARTY',
            error: 'A witness cannot be one of the people signing the agreement',
          } as const;
        }
        const others = await tx.agreementWitness.findMany({ where: { agreementId: agreement.id } });
        if (others.some((w) => w.side !== body.side && w.email.toLowerCase() === email)) {
          return {
            ok: false,
            status: 400,
            code: 'WITNESS_ON_BOTH_SIDES',
            error: 'The two witnesses must be different people',
          } as const;
        }
        const existing = others.find((w) => w.side === body.side);
        if (existing?.status === 'SIGNED') {
          return {
            ok: false,
            status: 409,
            code: 'WITNESS_ALREADY_SIGNED',
            error: 'This witness has already signed',
          } as const;
        }
        // Asking the same address again counts toward the cap; so does swapping the address.
        if (existing && existing.sendCount >= WITNESS_MAX_SENDS) {
          return {
            ok: false,
            status: 429,
            code: 'WITNESS_SEND_LIMIT',
            error: `The link has been sent ${WITNESS_MAX_SENDS} times for this witness. Ask them to check their spam folder, or contact support.`,
          } as const;
        }

        const token = newWitnessToken();
        const now = new Date();
        const data = {
          name: body.name,
          email,
          address: body.address || null,
          tokenHash: token.hash,
          tokenExpiresAt: witnessLinkExpiry(settings.witnessLinkDays, now),
          invitedById: session.sub,
          lastSentAt: now,
        };
        const witness = existing
          ? await tx.agreementWitness.update({
              where: { id: existing.id },
              data: { ...data, sendCount: { increment: 1 } },
            })
          : await tx.agreementWitness.create({
              data: { ...data, agreementId: agreement.id, side: body.side },
            });

        // The printed details follow the person who was asked.
        const key = body.side === 'LANDLORD' ? 'landlord' : 'tenant';
        const typed = (agreement.witnesses ?? {}) as Record<
          string,
          { name: string; address: string }
        >;
        await tx.rentAgreement.update({
          where: { id: agreement.id },
          data: {
            witnesses: { ...typed, [key]: { name: body.name, address: body.address ?? '' } },
          },
        });
        return { ok: true, witness, raw: token.raw } as const;
      });

      if (!result.ok) return fail(result.status, result.code, result.error);

      const party =
        session.role === 'TENANT'
          ? rent.tenant.name
          : (property.manager?.name ?? property.landlord?.name ?? 'The property team');
      const mail = await sendEmail(
        witnessEmail(
          result.witness,
          { property: property.name, unit: rent.unit.unitNumber, party },
          result.raw,
          settings.witnessLinkDays,
          req,
        ),
      );
      return NextResponse.json(
        { data: { ...serializeWitness(result.witness), emailed: mail.delivered } },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);
