import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentFrequency, UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, isPublicUnit, serializeUnit } from '@/lib/api/propertyAccess';
import { listingViewer, sessionOrNull } from '@/lib/api/listingAccess';
import { safeUrlList } from '@/lib/api/urlField';

import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';
import { getSystemSettings } from '@/lib/systemSettings';
import { PlanLimitError, assertUnitCapacity } from '@/lib/plans';

// Lists are capped so one busy record cannot return an unbounded response (ISS-073).
const LIST_LIMIT = 500;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const status = req.nextUrl.searchParams.get('status');

    // Units follow the listing rule: an unlisted property, and the units marked private, are not
    // public (ISS-146).
    const property = await prisma.property.findUnique({ where: { id } });
    const viewer = property && (await listingViewer(await sessionOrNull(), property));
    if (!property || !viewer?.visible) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const units = await prisma.unit.findMany({
      take: LIST_LIMIT,
      where: { propertyId: id, ...(status ? { status: status as UnitStatus } : {}) },
      orderBy: { unitNumber: 'asc' },
    });
    const shown = viewer.seesAll ? units : units.filter(isPublicUnit);

    return NextResponse.json({ data: shown.map(serializeUnit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const createUnitSchema = z.object({
  unitNumber: z.string().min(1),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().min(0),
  rentAmount: z.number().positive(),
  listedPaymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
  depositAmount: z.number().optional(),
  serviceCharge: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  mediaUrls: safeUrlList.optional(),
  sqft: z.number().int().optional(),
  // Sent again after the screen has shown what units over the plan will cost (OVERAGE_NEEDS_CONFIRMATION).
  confirmOverage: z.boolean().optional(),
});

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, createUnitSchema);
    if (!validated.success) return validated.response;
    const { sqft, confirmOverage, ...data } = validated.data;

    const isLandlordOrManager = session.role === 'LANDLORD' || session.role === 'MANAGER';
    const amenities = data.amenities ?? [];
    // If added by landlord or manager, mark unit as pending approval so it stays hidden
    // from the public marketplace until approved, without taking the parent property offline.
    const unitAmenities =
      isLandlordOrManager && !amenities.includes('approval:pending')
        ? [...amenities, 'approval:pending']
        : amenities;

    // The plan's unit limit is checked and the unit created in one transaction, so two requests at
    // once cannot both squeeze under it.
    const settings = await getSystemSettings();
    const unit = await prisma.$transaction(async (tx) => {
      await assertUnitCapacity(tx, {
        settings,
        property,
        adding: 1,
        actor: { id: session.sub, role: session.role },
        confirmOverage,
      });
      return tx.unit.create({
        data: { ...data, amenities: unitAmenities, propertyId: id, squareFeet: sqft },
      });
    });

    // Notify admins of new unit awaiting review
    if (isLandlordOrManager) {
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true, name: true },
        });
        const creator = await prisma.user.findUnique({
          where: { id: session.sub },
          select: { name: true, email: true, role: true },
        });
        const adminEmails = [...new Set([...admins.map((a) => a.email), 'admin@proplity.com'])];
        for (const adminEmail of adminEmails) {
          await sendEmail({
            to: adminEmail,
            subject: `New Unit Added Awaiting Approval: Unit ${unit.unitNumber} at ${property.name}`,
            body: `Hi Admin,\n\nA new unit (${unit.unitNumber}, ${unit.bedrooms} bed, ₦${unit.rentAmount.toLocaleString()}) has been added to "${property.name}" by ${creator?.name ?? 'User'} (${creator?.email ?? ''}, ${creator?.role ?? ''}).\n\nThis unit is hidden from public discovery until approved. The parent property remains live.\n\nReview and approve this unit in the Moderation Queue:\n${appUrl('/admin/properties', req)}`,
          });
        }
      } catch (mailErr) {
        console.error('Failed to email admins of new unit', mailErr);
      }
    }

    return NextResponse.json({ data: serializeUnit(unit) }, { status: 201 });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json(
        { error: err.message, code: err.code, ...err.details },
        { status: err.status },
      );
    }
    return handleApiError(err);
  }
});
