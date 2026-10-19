import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { appUrl } from '@/lib/appUrl';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { sendEmail } from '@/lib/email';
import { applyPendingChanges } from '@/lib/propertyPendingChanges';

type RouteCtx = { params: Promise<{ id: string }> };

// The "AI/admin review pipeline" property.prisma's own moderationStatus
// comment refers to -- there's no real AI check anywhere in this codebase
// to stand in for, so this is a real human (ADMIN) decision, not automated.
// Separate from isPublished (the property's own manager/landlord toggle,
// gated on APPROVED -- see properties/[id]/route.ts): approving a listing
// here doesn't publish it by itself, it only makes publishing possible.
const moderationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'FLAGGED']),
  moderationNotes: z.string().optional(),
});

export const PATCH = withAuth(
  async (req, _session, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const property = await prisma.property.findUnique({
        where: { id },
        include: { manager: true, landlord: true },
      });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

      const validated = await validateBody(req, moderationSchema);
      if (!validated.success) return validated.response;

      const isApproved = validated.data.status === 'APPROVED';
      const approvalDateIso = new Date().toISOString();
      let updatedNotes = validated.data.moderationNotes ?? property.moderationNotes ?? '';
      const currentMeta = (property.metadata as Record<string, unknown>) || {};
      const pendingChanges = currentMeta.pendingChanges as Record<string, unknown> | undefined;

      if (isApproved) {
        // Tag with approval timestamp and clear EDITED tag
        const cleanedNotes = updatedNotes
          .replace(/\[APPROVED:[^\]]+\]\s*/g, '')
          .replace(/\[EDITED[^\]]*\]\s*/g, '')
          .trim();
        updatedNotes = `[APPROVED:${approvalDateIso}]${cleanedNotes ? ` ${cleanedNotes}` : ''}`;

        // The staged edits are applied with the approval, in one transaction below.
      }

      // Clear pendingChanges on approval or rejection
      const { pendingChanges: _removed, ...restMeta } = currentMeta;

      const data: {
        moderationStatus: 'APPROVED' | 'REJECTED' | 'FLAGGED';
        moderationNotes?: string;
        isPublished?: boolean;
        metadata?: Prisma.InputJsonObject;
      } = {
        moderationStatus: validated.data.status,
        moderationNotes: updatedNotes,
        metadata: restMeta as Prisma.InputJsonObject,
      };
      // A property rejected or flagged after having been published (e.g. a
      // later re-review) must not stay publicly visible -- unpublish it in
      // the same action rather than leaving isPublished stale and true.
      if (validated.data.status !== 'APPROVED') {
        data.isPublished = false;
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (isApproved) {
          // Staged property and unit edits are applied here; units of other
          // properties are skipped (ISS-060).
          await applyPendingChanges(tx, property, pendingChanges);
          // Approve any pending units for this property by removing 'approval:pending'
          const pendingUnits = await tx.unit.findMany({
            where: { propertyId: id, amenities: { has: 'approval:pending' } },
            select: { id: true, amenities: true },
          });
          for (const u of pendingUnits) {
            await tx.unit.update({
              where: { id: u.id },
              data: { amenities: u.amenities.filter((a) => a !== 'approval:pending') },
            });
          }
        }
        return tx.property.update({ where: { id }, data });
      });

      // Notify BOTH the manager and the landlord by email
      const recipients = [property.manager, property.landlord].filter(
        (u): u is NonNullable<typeof u> => Boolean(u?.email),
      );
      const uniqueRecipients = [...new Map(recipients.map((r) => [r.email, r])).values()];

      for (const recipient of uniqueRecipients) {
        if (validated.data.status !== 'FLAGGED') {
          const approved = validated.data.status === 'APPROVED';
          await sendEmail({
            to: recipient.email,
            subject: approved
              ? `Your Proplity listing was approved: ${property.name}`
              : `Your Proplity listing needs changes: ${property.name}`,
            body: approved
              ? `Hi ${recipient.name},\n\n"${property.name}" has been approved by admin and can now be published.\n\nSign in to Proplity to publish it: ${appUrl(`/dashboard/properties/${property.id}`, req)}`
              : `Hi ${recipient.name},\n\n"${property.name}" was not approved.${
                  validated.data.moderationNotes
                    ? `\n\nReviewer notes: ${validated.data.moderationNotes}`
                    : ''
                }\n\nSign in to Proplity for details: ${appUrl(`/dashboard/properties/${property.id}`, req)}`,
          });
        }
      }

      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
