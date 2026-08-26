import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string; announcementId: string }> };

async function loadOwned(propertyId: string, announcementId: string) {
  const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!announcement || announcement.propertyId !== propertyId) return null;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  return { announcement, property };
}

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  isPinned: z.boolean().optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id, announcementId } = await ctx.params;
    try {
      const found = await loadOwned(id, announcementId);
      if (!found) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
      if (!canManageProperty(session, found.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, updateAnnouncementSchema);
      if (!validated.success) return validated.response;

      const updated = await prisma.announcement.update({
        where: { id: announcementId },
        data: validated.data,
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);

// Hard delete is acceptable here -- unlike AccessCode, nothing cascades
// from Announcement and there's no audit-trail requirement over it (PRD
// §5.3's audit trail is specifically about gate access, rule 1).
export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id, announcementId } = await ctx.params;
    try {
      const found = await loadOwned(id, announcementId);
      if (!found) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
      if (!canManageProperty(session, found.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.announcement.delete({ where: { id: announcementId } });
      return NextResponse.json({ data: { id: announcementId, deleted: true } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
