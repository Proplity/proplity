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

type RouteCtx = { params: Promise<{ id: string }> };

const signSchema = z.object({
  fullName: z.string().min(1),
});

// Click-wrap e-signature (PRD §5.1/§5.2): typed full legal name + timestamp
// + IP recorded as the signature event, not a drawn/uploaded image -- no
// file-storage endpoint exists anywhere in this codebase to hold one. One
// row per signer per lease (LeaseSignature's @@unique([leaseId, signerId])
// -- a second attempt by the same person 409s rather than duplicating.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }

    const { id } = await ctx.params;
    try {
      const lease = await prisma.lease.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

      const isOwningTenant = session.role === 'TENANT' && lease.tenantId === session.sub;
      const isManagingOwner = canManageProperty(session, lease.unit.property);
      if (!isOwningTenant && !isManagingOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, signSchema);
      if (!validated.success) return validated.response;

      const existing = await prisma.leaseSignature.findUnique({
        where: { leaseId_signerId: { leaseId: id, signerId: session.sub } },
      });
      if (existing) {
        return NextResponse.json({ error: 'You have already signed this lease' }, { status: 409 });
      }

      const signature = await prisma.$transaction(async (tx) => {
        // Serialise signers of the same lease: without this a tenant and a landlord
        // signing at the same moment each see only their own signature and the lease
        // is never marked fully signed.
        await tx.$queryRaw`SELECT "id" FROM "Lease" WHERE "id" = ${id} FOR UPDATE`;
        const created = await tx.leaseSignature.create({
          data: {
            leaseId: id,
            signerId: session.sub,
            signerRole: session.role,
            fullNameTyped: validated.data.fullName,
            ipAddress: getClientIp(req),
          },
        });

        // Fully executed once both a tenant-side and a landlord-side
        // signature exist -- agreementSignedAt was a schema field nobody
        // ever wrote to before this route existed.
        if (!lease.agreementSignedAt) {
          const allSignatures = await tx.leaseSignature.findMany({ where: { leaseId: id } });
          const hasTenantSignature = allSignatures.some((s) => s.signerRole === Role.TENANT);
          const hasLandlordSideSignature = allSignatures.some(
            (s) =>
              s.signerRole === Role.MANAGER ||
              s.signerRole === Role.LANDLORD ||
              s.signerRole === Role.ADMIN,
          );
          if (hasTenantSignature && hasLandlordSideSignature) {
            await tx.lease.update({ where: { id }, data: { agreementSignedAt: new Date() } });
          }
        }

        return created;
      });

      // Send signature confirmation emails
      try {
        const fullLease = await prisma.lease.findUnique({
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
        if (fullLease) {
          const signerName = validated.data.fullName || session.role;
          const parties = [
            fullLease.tenant,
            fullLease.unit.property.manager,
            fullLease.unit.property.landlord,
          ].filter((p): p is { email: string; name: string } => Boolean(p?.email));
          const uniqueParties = [...new Map(parties.map((p) => [p.email, p])).values()];
          for (const party of uniqueParties) {
            await sendEmail({
              to: party.email,
              subject: `Digital Signature Recorded: Lease for Unit ${fullLease.unit.unitNumber}`,
              body: `Hi ${party.name},\n\n${signerName} has digitally signed the lease agreement for unit ${fullLease.unit.unitNumber} at ${fullLease.unit.property.name}.\n\nView the active lease in your Proplity dashboard:\n${appUrl('/dashboard/leases', req)}`,
            });
          }
        }
      } catch (signMailErr) {
        console.error('Failed to dispatch lease signature email', signMailErr);
      }

      return NextResponse.json({ data: signature }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);
