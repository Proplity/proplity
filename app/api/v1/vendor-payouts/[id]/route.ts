import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, PUBLIC_PROPERTY } from '@/lib/api/propertyAccess';
import {
  approveVendorPayout,
  processVendorPayout,
  rejectVendorPayout,
  VendorPayoutError,
} from '@/lib/payments/payoutService';

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const payout = await prisma.vendorPayout.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        bankAccount: true,
        invoice: {
          include: {
            maintenanceRequest: {
              include: { unit: { include: { property: PUBLIC_PROPERTY } } },
            },
          },
        },
        maintenanceRequest: {
          include: { unit: { include: { property: PUBLIC_PROPERTY } } },
        },
        initiatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Vendor payout not found' }, { status: 404 });
    }

    const isRecipientVendor = payout.vendorId === session.sub;
    const property =
      payout.invoice?.maintenanceRequest?.unit?.property ??
      payout.maintenanceRequest?.unit?.property;

    const canManage =
      session.role === 'ADMIN' || (property && canManageProperty(session, property));

    if (!isRecipientVendor && !canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: payout });
  } catch (err) {
    return handleApiError(err);
  }
});

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'PROCESS', 'REJECT']),
  reason: z.string().trim().max(500).optional(),
  externalReference: z.string().trim().max(120).optional(),
  manualNote: z.string().trim().max(500).optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;

      const { action, reason, externalReference, manualNote } = validated.data;

      try {
        let updated;
        if (action === 'APPROVE') {
          updated = await approveVendorPayout(session, id);
        } else if (action === 'PROCESS') {
          updated = await processVendorPayout(session, id, {
            externalReference,
            manualNote,
          });
        } else if (action === 'REJECT') {
          if (!reason) {
            return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
          }
          updated = await rejectVendorPayout(session, id, reason);
        }

        return NextResponse.json({ data: updated });
      } catch (err) {
        if (err instanceof VendorPayoutError) {
          return NextResponse.json({ error: err.message }, { status: err.statusCode });
        }
        throw err;
      }
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
