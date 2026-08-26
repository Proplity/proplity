import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

async function canViewProperty(
  session: { sub: string; role: Role },
  propertyId: string,
  property: { managerId: string | null; landlordId: string | null },
) {
  if (canManageProperty(session, property)) return true;
  if (session.role !== 'TENANT') return false;
  const activeLease = await prisma.lease.findFirst({
    where: { unit: { propertyId }, tenantId: session.sub, status: 'ACTIVE' },
  });
  return !!activeLease;
}

// Tenants of the property need to read these too -- VENDOR has no
// legitimate reason to see a landlord's announcements.
export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!(await canViewProperty(session, id, property))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const announcements = await prisma.announcement.findMany({
        where: { propertyId: id },
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      });
      return NextResponse.json({ data: announcements });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  isPinned: z.boolean().optional(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, createAnnouncementSchema);
      if (!validated.success) return validated.response;

      const announcement = await prisma.announcement.create({
        data: { propertyId: id, authorId: session.sub, ...validated.data },
      });
      return NextResponse.json({ data: announcement }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
