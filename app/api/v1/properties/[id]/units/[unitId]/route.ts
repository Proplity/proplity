import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentFrequency, UnitStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import {
  PENDING_UNIT_FLAG,
  canManageProperty,
  isPublicUnit,
  serializeUnit,
} from '@/lib/api/propertyAccess';
import { listingViewer, sessionOrNull } from '@/lib/api/listingAccess';
import { safeUrlList } from '@/lib/api/urlField';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';

type RouteCtx = { params: Promise<{ id: string; unitId: string }> };

async function loadUnitWithProperty(propertyId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== propertyId) return null;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  return { unit, property };
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id, unitId } = await params;
    const found = await loadUnitWithProperty(id, unitId);
    if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    const viewer = await listingViewer(await sessionOrNull(), found.property);
    if (!viewer.visible || (!viewer.seesAll && !isPublicUnit(found.unit))) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    return NextResponse.json({ data: serializeUnit(found.unit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  rentAmount: z.number().positive().optional(),
  listedPaymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
  depositAmount: z.number().optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  amenities: z.array(z.string()).optional(),
  mediaUrls: safeUrlList.optional(),
  sqft: z.number().int().optional(),
  action: z.enum(['APPROVE', 'REJECT']).optional(),
  saveAsDraft: z.boolean().optional(),
  cancelPendingEdits: z.boolean().optional(),
  deletePendingEdits: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id, unitId } = await ctx.params;

  try {
    const found = await loadUnitWithProperty(id, unitId);
    if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!canManageProperty(session, found.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, updateUnitSchema);
    if (!validated.success) return validated.response;

    // Handle Landlord cancelling approval request for a unit
    if (validated.data.cancelPendingEdits) {
      const currentMeta = (found.property.metadata as Record<string, unknown>) || {};
      const pendingChanges = (currentMeta.pendingChanges as Record<string, unknown>) || {};
      const pendingUnits = (pendingChanges.units as Record<string, Record<string, unknown>>) || {};
      if (!pendingUnits[unitId]) {
        return NextResponse.json({
          data: serializeUnit(found.unit),
          message: 'No pending unit edits to cancel',
        });
      }

      const updatedPending = {
        ...pendingChanges,
        status: 'DRAFT',
        updatedAt: new Date().toISOString(),
      };

      await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentMeta,
            pendingChanges: updatedPending,
          } as Prisma.InputJsonObject,
        },
      });

      return NextResponse.json({
        data: serializeUnit(found.unit),
        message: 'Unit approval request cancelled. Edits moved back to draft.',
      });
    }

    // Handle Landlord deleting draft edits for a unit (Blocked if under review!)
    if (validated.data.deletePendingEdits) {
      const currentMeta = (found.property.metadata as Record<string, unknown>) || {};
      const pendingChanges = (currentMeta.pendingChanges as Record<string, unknown>) || {};
      const pendingUnits = (pendingChanges.units as Record<string, Record<string, unknown>>) || {};
      if (!pendingUnits[unitId]) {
        return NextResponse.json({
          data: serializeUnit(found.unit),
          message: 'No draft unit edits to delete',
        });
      }

      if (pendingChanges.status === 'PENDING_REVIEW') {
        return NextResponse.json(
          {
            error:
              'Unit edits currently under review cannot be deleted directly. You must cancel the approval request first before deleting.',
            code: 'UNDER_REVIEW_CANNOT_DELETE',
          },
          { status: 400 },
        );
      }

      delete pendingUnits[unitId];
      await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentMeta,
            pendingChanges: {
              ...pendingChanges,
              units: pendingUnits,
            },
          } as Prisma.InputJsonObject,
        },
      });

      return NextResponse.json({
        data: serializeUnit(found.unit),
        message: 'Draft unit edits deleted successfully.',
      });
    }

    // Admin direct approval/rejection of a pending unit
    if (validated.data.action) {
      if (session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only admins can approve or reject units' },
          { status: 403 },
        );
      }

      if (validated.data.action === 'APPROVE') {
        const cleanedAmenities = (found.unit.amenities || []).filter(
          (a) => a !== 'approval:pending',
        );

        // Check if there are staged changes for this unit in property.metadata
        const currentMeta = (found.property.metadata as Record<string, unknown>) || {};
        const pendingChanges = (currentMeta.pendingChanges as Record<string, unknown>) || {};
        const pendingUnits =
          (pendingChanges.units as Record<string, Record<string, unknown>>) || {};
        const unitStaged = pendingUnits[unitId];

        let unitUpdateData: Record<string, unknown> = { amenities: cleanedAmenities };
        if (unitStaged) {
          const { sqft, ...stagedFields } = unitStaged;
          unitUpdateData = {
            ...unitUpdateData,
            ...stagedFields,
            ...(sqft !== undefined ? { squareFeet: sqft as number } : {}),
          };
          delete pendingUnits[unitId];
          await prisma.property.update({
            where: { id },
            data: {
              metadata: {
                ...currentMeta,
                pendingChanges: {
                  ...pendingChanges,
                  units: pendingUnits,
                },
              } as Prisma.InputJsonObject,
            },
          });
        }

        const approvedUnit = await prisma.unit.update({
          where: { id: unitId },
          data: unitUpdateData,
        });
        return NextResponse.json({ data: serializeUnit(approvedUnit) });
      }

      if (validated.data.action === 'REJECT') {
        // Discard staged changes or pending unit
        const currentMeta = (found.property.metadata as Record<string, unknown>) || {};
        const pendingChanges = (currentMeta.pendingChanges as Record<string, unknown>) || {};
        const pendingUnits =
          (pendingChanges.units as Record<string, Record<string, unknown>>) || {};
        if (pendingUnits[unitId]) {
          delete pendingUnits[unitId];
          await prisma.property.update({
            where: { id },
            data: {
              metadata: {
                ...currentMeta,
                pendingChanges: {
                  ...pendingChanges,
                  units: pendingUnits,
                },
              } as Prisma.InputJsonObject,
            },
          });
        }

        // If unit was purely a pending unit without leases, delete it
        if (found.unit.amenities.includes('approval:pending')) {
          const leaseCount = await prisma.lease.count({ where: { unitId } });
          if (leaseCount === 0) {
            await prisma.unit.delete({ where: { id: unitId } });
            return NextResponse.json({ data: { id: unitId, rejected: true, deleted: true } });
          }
        }
        return NextResponse.json({ data: { id: unitId, rejected: true } });
      }
    }

    const { sqft, action: _act, saveAsDraft, ...data } = validated.data;
    // The "awaiting approval" marker belongs to the server: only an admin's approval clears it, and
    // a manager or landlord cannot add it back or drop it by sending their own amenities (ISS-153).
    if (data.amenities && session.role !== 'ADMIN') {
      const others = data.amenities.filter((a) => a !== PENDING_UNIT_FLAG);
      data.amenities = found.unit.amenities.includes(PENDING_UNIT_FLAG)
        ? [...others, PENDING_UNIT_FLAG]
        : others;
    }
    const isLandlordOrManager = session.role === 'LANDLORD' || session.role === 'MANAGER';
    const isEditingCritical =
      data.rentAmount !== undefined ||
      data.unitNumber !== undefined ||
      data.bedrooms !== undefined ||
      data.bathrooms !== undefined;

    // Handle Landlord saving unit changes as draft or proposing changes to a live unit
    if (
      isLandlordOrManager &&
      (saveAsDraft ||
        (isEditingCritical &&
          found.property.isPublished &&
          !found.unit.amenities.includes('approval:pending')))
    ) {
      const currentMeta = (found.property.metadata as Record<string, unknown>) || {};
      const existingPending = (currentMeta.pendingChanges as Record<string, unknown>) || {};
      const existingUnits =
        (existingPending.units as Record<string, Record<string, unknown>>) || {};

      const stagedUnit = {
        ...(existingUnits[unitId] || {}),
        ...data,
        ...(sqft !== undefined ? { sqft } : {}),
      };

      const updatedPending = {
        ...existingPending,
        status: saveAsDraft ? ('DRAFT' as const) : ('PENDING_REVIEW' as const),
        updatedAt: new Date().toISOString(),
        units: {
          ...existingUnits,
          [unitId]: stagedUnit,
        },
      };

      await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentMeta,
            pendingChanges: updatedPending,
          } as Prisma.InputJsonObject,
        },
      });

      if (!saveAsDraft) {
        // Send alert to admin about pending unit edit
        try {
          const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true },
          });
          const adminEmails = [...new Set([...admins.map((a) => a.email), 'admin@proplity.com'])];
          for (const email of adminEmails) {
            await sendEmail({
              to: email,
              subject: `Unit Specs Edit Awaiting Review: Unit ${found.unit.unitNumber} at ${found.property.name}`,
              body: `Hi Admin,\n\nUnit ${found.unit.unitNumber} at "${found.property.name}" has proposed updates awaiting approval.\n\nLive listing remains published while changes are staged.\n\nReview changes in the Moderation Queue:\n${appUrl('/admin/properties', req)}`,
            });
          }
        } catch (emailErr) {
          console.error('Failed to notify admins of unit edit', emailErr);
        }
      }

      return NextResponse.json({
        data: {
          ...serializeUnit(found.unit),
          pendingChanges: stagedUnit,
        },
      });
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: { ...data, ...(sqft !== undefined ? { squareFeet: sqft } : {}) },
    });
    return NextResponse.json({ data: serializeUnit(updated) });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id, unitId } = await ctx.params;

  try {
    const found = await loadUnitWithProperty(id, unitId);
    if (!found) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!canManageProperty(session, found.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Lease.unit has onDelete: Cascade -- a hard delete here would silently
    // wipe lease/tenancy history for the unit. Refuse rather than cascade;
    // there's no ARCHIVED UnitStatus to soft-delete into instead.
    const leaseCount = await prisma.lease.count({ where: { unitId } });
    if (leaseCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a unit with lease history', code: 'HAS_LEASES' },
        { status: 409 },
      );
    }

    await prisma.unit.delete({ where: { id: unitId } });
    return NextResponse.json({ data: { id: unitId, deleted: true } });
  } catch (err) {
    return handleApiError(err);
  }
});
