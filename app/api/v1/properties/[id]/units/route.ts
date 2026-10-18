import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentFrequency, UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, serializeUnit } from '@/lib/api/propertyAccess';
import { safeUrlList } from '@/lib/api/urlField';

import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const status = req.nextUrl.searchParams.get('status');

    const units = await prisma.unit.findMany({
      where: { propertyId: id, ...(status ? { status: status as UnitStatus } : {}) },
      orderBy: { unitNumber: 'asc' },
    });

    return NextResponse.json({ data: units.map(serializeUnit) });
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
    const { sqft, ...data } = validated.data;

    const isLandlordOrManager = session.role === 'LANDLORD' || session.role === 'MANAGER';
    const amenities = data.amenities ?? [];
    // If added by landlord or manager, mark unit as pending approval so it stays hidden
    // from the public marketplace until approved, without taking the parent property offline.
    const unitAmenities =
      isLandlordOrManager && !amenities.includes('approval:pending')
        ? [...amenities, 'approval:pending']
        : amenities;

    const unit = await prisma.unit.create({
      data: { ...data, amenities: unitAmenities, propertyId: id, squareFeet: sqft },
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
    return handleApiError(err);
  }
});
