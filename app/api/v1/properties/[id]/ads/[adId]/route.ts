import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string; adId: string }> };

// Soft-cancel only, same archive-over-delete convention as AccessCode
// revocation (rule 1) -- no prisma.adCampaign.delete() anywhere.
export const PATCH = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id: propertyId, adId } = await ctx.params;

    try {
      const property = await prisma.property.findUnique({ where: { id: propertyId } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const campaign = await prisma.adCampaign.findUnique({ where: { id: adId } });
      if (!campaign || campaign.propertyId !== propertyId) {
        return NextResponse.json({ error: 'Ad campaign not found' }, { status: 404 });
      }

      const updated = await prisma.adCampaign.update({
        where: { id: adId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
