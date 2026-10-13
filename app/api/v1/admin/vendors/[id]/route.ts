import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { notifyByEmail, notifyUser } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

// An admin vets a vendor's business (ISS-043). Only VERIFIED vendors appear
// in the assign-vendor list and can be assigned a job. `id` is the vendor's
// user id. Every decision is audit-logged and the vendor is told.
export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const { status, note } = validated.data;

      const vendor = await prisma.user.findFirst({
        where: { id, role: 'VENDOR' },
        include: { vendorProfile: true },
      });
      if (!vendor?.vendorProfile) {
        return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
      }

      const profile = await prisma.vendorProfile.update({
        where: { id: vendor.vendorProfile.id },
        data: {
          verificationStatus: status,
          verificationNote: note || null,
          verifiedAt: new Date(),
          verifiedById: session.sub,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: status === 'VERIFIED' ? 'VENDOR_VERIFIED' : 'VENDOR_REJECTED',
          entityType: 'VendorProfile',
          entityId: profile.id,
          metadata: {
            vendorUserId: vendor.id,
            businessName: profile.businessName,
            note: note ?? null,
          },
        },
      });

      const ok = status === 'VERIFIED';
      await notifyUser(vendor.id, {
        type: 'SYSTEM',
        title: ok ? 'Your business is verified' : 'Verification not approved',
        body: ok
          ? 'Landlords and managers can now find and assign you to jobs.'
          : `We could not verify your business.${note ? ` Reason: ${note}` : ''}`,
        link: '/dashboard',
      });
      await notifyByEmail(
        vendor.email,
        ok ? 'Your Proplity business is verified' : 'Proplity verification update',
        ok
          ? `Hi ${vendor.name},\n\nYour business "${profile.businessName}" is verified. Landlords and managers can now find and assign you to jobs.`
          : `Hi ${vendor.name},\n\nWe could not verify "${profile.businessName}".${note ? `\n\nReason: ${note}` : ''}\n\nReply to this email if you think this is a mistake.`,
      );

      return NextResponse.json({ data: profile });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
