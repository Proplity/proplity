import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { sendEmail } from '@/lib/email';

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

      const data: { moderationStatus: 'APPROVED' | 'REJECTED' | 'FLAGGED'; moderationNotes?: string; isPublished?: boolean } = {
        moderationStatus: validated.data.status,
        moderationNotes: validated.data.moderationNotes,
      };
      // A property rejected or flagged after having been published (e.g. a
      // later re-review) must not stay publicly visible -- unpublish it in
      // the same action rather than leaving isPublished stale and true.
      if (validated.data.status !== 'APPROVED') {
        data.isPublished = false;
      }

      const updated = await prisma.property.update({ where: { id }, data });

      // ListProperty.tsx tells the submitting manager/landlord "you will be
      // notified once approved" -- make that literally true, same
      // console-transport sendEmail() the tenant-invite flow already uses.
      const recipient = property.manager ?? property.landlord;
      if (recipient && validated.data.status !== 'FLAGGED') {
        const approved = validated.data.status === 'APPROVED';
        await sendEmail({
          to: recipient.email,
          subject: approved ? 'Your Proplity listing was approved' : 'Your Proplity listing needs changes',
          body: approved
            ? `Hi ${recipient.name},\n\n"${property.name}" has been approved and can now be published.\n\nSign in to Proplity to publish it: http://localhost:3000/dashboard/properties/${property.id}`
            : `Hi ${recipient.name},\n\n"${property.name}" was not approved.${
                validated.data.moderationNotes ? `\n\nReviewer notes: ${validated.data.moderationNotes}` : ''
              }\n\nSign in to Proplity for details: http://localhost:3000/dashboard/properties/${property.id}`,
        });
      }

      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
