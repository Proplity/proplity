import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { validateCSRF } from '@/lib/auth/csrf';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { getClientIp } from '@/lib/auth/rateLimit';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

const signSchema = z.object({
  fullName: z.string().min(1),
});

// Click-wrap e-signature (PRD §5.1/§5.2): typed full legal name + timestamp
// + IP recorded as the signature event, not a drawn/uploaded image -- no
// file-storage endpoint exists anywhere in this codebase to hold one. One
// row per signer per rent (RentSignature's @@unique([rentId, signerId])
// -- a second attempt by the same person 409s rather than duplicating.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }

    const { id } = await ctx.params;
    try {
      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });

      const isOwningTenant = session.role === 'TENANT' && rent.tenantId === session.sub;
      const isManagingOwner = canManageProperty(session, rent.unit.property);
      if (!isOwningTenant && !isManagingOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, signSchema);
      if (!validated.success) return validated.response;

      const existing = await prisma.rentSignature.findUnique({
        where: { rentId_signerId: { rentId: id, signerId: session.sub } },
      });
      if (existing) {
        return NextResponse.json({ error: 'You have already signed this rent' }, { status: 409 });
      }

      const signature = await prisma.$transaction(async (tx) => {
        // Serialise signers of the same rent: without this a tenant and a landlord
        // signing at the same moment each see only their own signature and the rent
        // is never marked fully signed.
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const created = await tx.rentSignature.create({
          data: {
            rentId: id,
            signerId: session.sub,
            signerRole: session.role,
            fullNameTyped: validated.data.fullName,
            ipAddress: getClientIp(req),
          },
        });

        // Fully executed once both a tenant-side and a landlord-side
        // signature exist -- agreementSignedAt was a schema field nobody
        // ever wrote to before this route existed.
        if (!rent.agreementSignedAt) {
          const allSignatures = await tx.rentSignature.findMany({ where: { rentId: id } });
          const hasTenantSignature = allSignatures.some((s) => s.signerRole === Role.TENANT);
          const hasLandlordSideSignature = allSignatures.some(
            (s) =>
              s.signerRole === Role.MANAGER ||
              s.signerRole === Role.LANDLORD ||
              s.signerRole === Role.ADMIN,
          );
          if (hasTenantSignature && hasLandlordSideSignature) {
            await tx.rent.update({ where: { id }, data: { agreementSignedAt: new Date() } });
          }
        }

        return created;
      });

      // Send signature confirmation emails
      try {
        const fullRent = await prisma.rent.findUnique({
          where: { id },
          include: {
            tenant: { select: { email: true, name: true } },
            unit: {
              include: {
                property: {
                  include: {
                    manager: { select: { email: true, name: true } },
                    landlord: { select: { email: true, name: true } },
                  },
                },
              },
            },
          },
        });
        if (fullRent) {
          const signerName = validated.data.fullName || session.role;
          const parties = [
            fullRent.tenant,
            fullRent.unit.property.manager,
            fullRent.unit.property.landlord,
          ].filter((p): p is { email: string; name: string } => Boolean(p?.email));
          const uniqueParties = [...new Map(parties.map((p) => [p.email, p])).values()];
          for (const party of uniqueParties) {
            await sendEmail({
              to: party.email,
              subject: `Digital Signature Recorded: Rent for Unit ${fullRent.unit.unitNumber}`,
              body: `Hi ${party.name},\n\n${signerName} has digitally signed the rent agreement for unit ${fullRent.unit.unitNumber} at ${fullRent.unit.property.name}.\n\nView the active rent in your Proplity dashboard:\n${appUrl('/dashboard', req)}`,
            });
          }
        }
      } catch (signMailErr) {
        console.error('Failed to dispatch rent signature email', signMailErr);
      }

      // In the app: say who needs to do what next. The emails above already went out.
      const signedBy = session.role === 'TENANT' ? 'The tenant' : 'The property team';
      const unitLabel = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
      const executed = await prisma.rent.findUnique({
        where: { id },
        select: { agreementSignedAt: true },
      });
      if (executed?.agreementSignedAt) {
        const fully = {
          title: 'Rent fully signed',
          body: `Both sides have signed the rent for ${unitLabel}.`,
        };
        await notifyAndEmail(rent.tenantId, { ...fully, link: '/dashboard' }, { email: false });
        await notifyPropertyTeam(
          rent.unit.property,
          { ...fully, link: `/dashboard/tenants/${id}` },
          { email: false },
        );
      } else if (session.role === 'TENANT') {
        await notifyPropertyTeam(
          rent.unit.property,
          {
            title: 'Tenant signed the rent',
            body: `${signedBy} signed the rent for ${unitLabel}. Your signature is needed to complete it.`,
            link: `/dashboard/tenants/${id}`,
          },
          { email: false },
        );
      } else {
        await notifyAndEmail(
          rent.tenantId,
          {
            title: 'Your rent is waiting for your signature',
            body: `${signedBy} signed the rent for ${unitLabel}. Add your signature to complete it.`,
            link: '/dashboard',
          },
          { email: false },
        );
      }

      return NextResponse.json({ data: signature }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);
