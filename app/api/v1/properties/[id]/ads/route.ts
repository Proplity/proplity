import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id: propertyId } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const active = await prisma.adCampaign.findFirst({
      where: { propertyId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: active });
  } catch (err) {
    return handleApiError(err);
  }
});

const createAdSchema = z.object({
  budget: z.number().int().positive(),
  durationDays: z.number().int().positive(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id: propertyId } = await ctx.params;

    try {
      const property = await prisma.property.findUnique({ where: { id: propertyId } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const existing = await prisma.adCampaign.findFirst({ where: { propertyId, status: 'ACTIVE' } });
      if (existing) {
        return NextResponse.json(
          { error: 'This property already has an active ad campaign', code: 'AD_CONFLICT' },
          { status: 409 },
        );
      }

      const validated = await validateBody(req, createAdSchema);
      if (!validated.success) return validated.response;

      const campaign = await prisma.adCampaign.create({
        data: { propertyId, createdById: session.sub, ...validated.data },
      });
      return NextResponse.json({ data: campaign }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
