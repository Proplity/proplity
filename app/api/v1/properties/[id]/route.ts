import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyType, Role, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, serializeUnit } from '@/lib/api/propertyAccess';
import { getServerSession } from '@/lib/auth/session';
import { safeUrl, safeUrlList } from '@/lib/api/urlField';
import { listingHash } from '@/lib/propertyFingerprint';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';
import { propertyMetadataSchema } from '@/lib/api/propertySchemas';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Visibility, in three tiers. This route stays *optionally* authenticated --
 * PublicPropertyDetail browses it logged-out and must keep working -- but an
 * unpublished listing is no longer readable by anyone who merely knows the id.
 *
 * A property is readable when ANY of these hold:
 *   1. it is published (the public tier -- mirrors the list endpoint's
 *      `isPublished: true` filter, which is the same gate. `isPublished` can
 *      only ever be flipped true after ADMIN approval, see PATCH below, so
 *      published implies moderation-approved);
 *   2. the caller manages it (its own manager/landlord, or an ADMIN) -- their
 *      dashboard has to show a pending-review listing;
 *   3. the caller is a tenant living in it. A landlord can unpublish a
 *      property that still has sitting tenants, and the tenant-facing property
 *      page (announcements, unit detail) reads this same endpoint -- so
 *      occupancy, not publication, is what governs their access.
 *
 * Anything else 404s rather than 403s: a 403 would confirm the id exists,
 * which is exactly the fact being protected.
 */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        units: true,
        neighbourhoodReports: { orderBy: { generatedAt: 'desc' }, take: 1 },
        reviews: { orderBy: { createdAt: 'desc' } },
        manager: { select: { id: true, name: true, email: true, phoneNumber: true, role: true } },
        landlord: { select: { id: true, name: true, email: true, phoneNumber: true, role: true } },
        mergedInto: { select: { id: true, name: true, address: true, city: true } },
        mergedFrom: { select: { id: true, name: true, address: true, city: true } },
      },
    });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    if (!property.isPublished) {
      const jwtSession = await getServerSession();
      if (!jwtSession) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      const session = { sub: jwtSession.sub, role: jwtSession.role as Role };

      let visible = canManageProperty(session, property);
      if (!visible) {
        // Any lease at all, not just ACTIVE: a tenant mid-renewal or just
        // past their end date still needs the property's announcements and
        // their own unit's history.
        const occupancy = await prisma.lease.findFirst({
          where: { tenantId: session.sub, unit: { propertyId: id } },
          select: { id: true },
        });
        visible = occupancy !== null;
      }

      if (!visible) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const { reviews, units, ...rest } = property;
    const ratings = reviews.map((r) => r.rating);
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    return NextResponse.json({
      data: {
        ...rest,
        units: units.map(serializeUnit),
        reviews: reviews.map((r) => ({ ...r, verified: r.leaseId !== null })),
        reviewStats: { count: reviews.length, averageRating },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  type: z.nativeEnum(PropertyType).optional(),
  description: z.string().optional(),
  imageUrl: safeUrl.optional(),
  video360Url: safeUrl.optional(),
  exteriorPhotoUrl: safeUrl.optional(),
  photoUrls: safeUrlList.optional(),
  managerId: z.string().optional(),
  landlordId: z.string().optional(),
  // The property's own manager/landlord visibility toggle -- independent of
  // moderationStatus (the ADMIN review outcome, set via the separate
  // /moderation route). Gated below: can only ever flip true once ADMIN has
  // approved the listing; false (unpublish) is always allowed.
  isPublished: z.boolean().optional(),
  metadata: propertyMetadataSchema.nullable().optional(),
  saveAsDraft: z.boolean().optional(),
  submitForReview: z.boolean().optional(),
  cancelPendingEdits: z.boolean().optional(),
  deletePendingEdits: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, updatePropertySchema);
    if (!validated.success) return validated.response;

    // Reassigning who manages/owns a property is a takeover vector, not an
    // ordinary listing edit -- restrict it to ADMIN, and require the target
    // id to actually be a user with the matching role.
    if (validated.data.managerId !== undefined || validated.data.landlordId !== undefined) {
      if (session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: "Only an admin may reassign a property's manager or landlord" },
          { status: 403 },
        );
      }
      if (validated.data.managerId) {
        const manager = await prisma.user.findUnique({ where: { id: validated.data.managerId } });
        if (!manager || manager.role !== 'MANAGER') {
          return NextResponse.json(
            { error: 'managerId must reference a MANAGER user' },
            { status: 400 },
          );
        }
      }
      if (validated.data.landlordId) {
        const landlord = await prisma.user.findUnique({ where: { id: validated.data.landlordId } });
        if (!landlord || landlord.role !== 'LANDLORD') {
          return NextResponse.json(
            { error: 'landlordId must reference a LANDLORD user' },
            { status: 400 },
          );
        }
      }
    }

    if (validated.data.isPublished === true && property.moderationStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          error: 'This listing must be approved by an admin before it can be published',
          code: 'NOT_APPROVED',
        },
        { status: 409 },
      );
    }

    const currentPropertyMeta =
      ((property as unknown as { metadata?: Record<string, unknown> | null }).metadata ||
        {}) as Record<string, unknown>;
    const existingPending = (currentPropertyMeta.pendingChanges as Record<string, unknown>) || null;

    // 1. CANCEL PENDING EDITS (Cancelling approval request)
    // Cancelling moves the edits from PENDING_REVIEW back to DRAFT, restores published status
    if (validated.data.cancelPendingEdits) {
      if (!existingPending) {
        return NextResponse.json({ data: property, message: 'No pending edits to cancel' });
      }

      const updatedPending = {
        ...existingPending,
        status: 'DRAFT',
        updatedAt: new Date().toISOString(),
        cancelledAt: new Date().toISOString(),
      };

      const cleanedNotes = (property.moderationNotes || '')
        .replace(/\[EDITED[^\]]*\]\s*/g, '')
        .trim();

      const restored = await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: updatedPending,
          } as Prisma.InputJsonObject,
          moderationNotes: cleanedNotes || null,
          moderationStatus: 'APPROVED',
          isPublished: true,
        },
      });
      return NextResponse.json({
        data: restored,
        message: 'Approval request cancelled. Edits moved back to draft.',
      });
    }

    // 2. DELETE PENDING EDITS (Discard draft)
    // CRITICAL: Edits currently under review cannot be deleted directly; must cancel first before delete!
    if (validated.data.deletePendingEdits) {
      if (!existingPending) {
        return NextResponse.json({ data: property, message: 'No draft edits to delete' });
      }

      if (existingPending.status === 'PENDING_REVIEW') {
        return NextResponse.json(
          {
            error:
              'Edits currently under review cannot be deleted directly. You must cancel the approval request first before deleting.',
            code: 'UNDER_REVIEW_CANNOT_DELETE',
          },
          { status: 400 },
        );
      }

      // Safe to delete because it is in DRAFT status
      const { pendingChanges: _removed, ...restMeta } = currentPropertyMeta;
      const cleanedNotes = (property.moderationNotes || '')
        .replace(/\[EDITED[^\]]*\]\s*/g, '')
        .trim();

      const restored = await prisma.property.update({
        where: { id },
        data: {
          metadata: restMeta as Prisma.InputJsonObject,
          moderationNotes: cleanedNotes || null,
        },
      });
      return NextResponse.json({ data: restored, message: 'Draft edits deleted successfully.' });
    }

    // 3. SUBMIT DRAFT FOR REVIEW
    if (validated.data.submitForReview) {
      if (!existingPending) {
        return NextResponse.json(
          { error: 'No draft edits found to submit for review', code: 'NO_DRAFT' },
          { status: 400 },
        );
      }

      const draftProp = (existingPending.property as Record<string, unknown>) || {};
      const isCritical =
        draftProp.name !== undefined ||
        draftProp.address !== undefined ||
        draftProp.city !== undefined ||
        draftProp.state !== undefined ||
        draftProp.type !== undefined;

      const dateFormatted = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const existingNotes = (property.moderationNotes || '')
        .replace(/\[EDITED[^\]]*\]\s*/g, '')
        .trim();

      const editedTag = isCritical
        ? `[EDITED:CRITICAL on ${dateFormatted}] Location or identity updated by ${session.role.toLowerCase()}${existingNotes ? ` | ${existingNotes}` : ''}`
        : `[EDITED:MINOR on ${dateFormatted}] Photos or description updated by ${session.role.toLowerCase()}${existingNotes ? ` | ${existingNotes}` : ''}`;

      const updatedPending = {
        ...existingPending,
        status: 'PENDING_REVIEW',
        submittedAt: new Date().toISOString(),
      };

      const updated = await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: updatedPending,
          } as Prisma.InputJsonObject,
          moderationNotes: editedTag,
          ...(isCritical ? { moderationStatus: 'PENDING_REVIEW', isPublished: false } : {}),
        },
      });

      // Send email alert to admins
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true, name: true },
        });
        const editor = await prisma.user.findUnique({
          where: { id: session.sub },
          select: { name: true, email: true, role: true },
        });
        const adminEmails = [
          ...new Set([...admins.map((a) => a.email), 'admin@proplity.com']),
        ];
        const subject = isCritical
          ? `[CRITICAL REVIEW] Property Location/Identity Updated: ${updated.name}`
          : `[CONTENT UPDATE] Property Photos/Description Updated: ${updated.name}`;

        const body = `Hi Admin,\n\nThe property listing "${updated.name}" had its draft edits submitted for review by ${editor?.name ?? 'User'} (${editor?.email ?? ''}, ${editor?.role ?? ''}).\n\n${isCritical ? 'Because critical fields were edited, the listing has been temporarily UNPUBLISHED and resubmitted to PENDING_REVIEW.' : 'The listing remains LIVE while awaiting review.'}\n\nPlease inspect the changes in the Moderation Queue:\n${appUrl(`/admin/properties`, req)}`;

        for (const adminEmail of adminEmails) {
          await sendEmail({ to: adminEmail, subject, body });
        }
      } catch (err) {
        console.error('Failed to notify admins of submitted property draft', err);
      }

      return NextResponse.json({
        data: updated,
        message: 'Draft edits submitted for review.',
      });
    }

    if (validated.data.saveAsDraft) {
      const draftProp = (existingPending?.property as Record<string, unknown>) || {};

      const draftPropFields: Record<string, unknown> = {};
      if (validated.data.name !== undefined) draftPropFields.name = validated.data.name;
      if (validated.data.address !== undefined) draftPropFields.address = validated.data.address;
      if (validated.data.city !== undefined) draftPropFields.city = validated.data.city;
      if (validated.data.state !== undefined) draftPropFields.state = validated.data.state;
      if (validated.data.zipCode !== undefined) draftPropFields.zipCode = validated.data.zipCode;
      if (validated.data.type !== undefined) draftPropFields.type = validated.data.type;
      if (validated.data.description !== undefined) draftPropFields.description = validated.data.description;
      if (validated.data.imageUrl !== undefined) draftPropFields.imageUrl = validated.data.imageUrl;
      if (validated.data.exteriorPhotoUrl !== undefined) draftPropFields.exteriorPhotoUrl = validated.data.exteriorPhotoUrl;
      if (validated.data.video360Url !== undefined) draftPropFields.video360Url = validated.data.video360Url;
      if (validated.data.photoUrls !== undefined) draftPropFields.photoUrls = validated.data.photoUrls;

      const updatedPending = {
        ...(existingPending || {}),
        status: 'DRAFT',
        updatedAt: new Date().toISOString(),
        property: {
          ...draftProp,
          ...draftPropFields,
        },
      };

      const updated = await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: updatedPending,
          } as Prisma.InputJsonObject,
        },
      });
      return NextResponse.json({ data: updated });
    }

    const {
      saveAsDraft: _draftFlag,
      submitForReview: _submitFlag,
      cancelPendingEdits: _cancelFlag,
      deletePendingEdits: _deleteFlag,
      managerId,
      landlordId,
      metadata: explicitMeta,
      ...cleanData
    } = validated.data;

    const isLandlordOrManager = session.role === 'LANDLORD' || session.role === 'MANAGER';
    const isEditingCritical =
      cleanData.name !== undefined ||
      cleanData.address !== undefined ||
      cleanData.city !== undefined ||
      cleanData.state !== undefined ||
      cleanData.type !== undefined;

    const isEditingContent =
      cleanData.description !== undefined ||
      cleanData.photoUrls !== undefined ||
      cleanData.imageUrl !== undefined ||
      cleanData.exteriorPhotoUrl !== undefined;

    let resubmissionData: Record<string, unknown> = {};
    if (isLandlordOrManager && (isEditingCritical || isEditingContent)) {
      // Clean previous EDITED tag if any
      const existingNotes = (property.moderationNotes || '').replace(/\[EDITED[^\]]*\]\s*/g, '').trim();
      const dateFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const existingPending = (currentPropertyMeta.pendingChanges as Record<string, unknown>) || {};

      const stagedPropertyChanges: Record<string, unknown> = {
        ...((existingPending.property as Record<string, unknown>) || {}),
      };
      if (cleanData.name !== undefined) stagedPropertyChanges.name = cleanData.name;
      if (cleanData.address !== undefined) stagedPropertyChanges.address = cleanData.address;
      if (cleanData.city !== undefined) stagedPropertyChanges.city = cleanData.city;
      if (cleanData.state !== undefined) stagedPropertyChanges.state = cleanData.state;
      if (cleanData.type !== undefined) stagedPropertyChanges.type = cleanData.type;
      if (cleanData.description !== undefined) stagedPropertyChanges.description = cleanData.description;
      if (cleanData.imageUrl !== undefined) stagedPropertyChanges.imageUrl = cleanData.imageUrl;
      if (cleanData.photoUrls !== undefined) stagedPropertyChanges.photoUrls = cleanData.photoUrls;

      if (isEditingCritical) {
        // Critical identity or location edit: unpublish and require full admin re-moderation
        const editedTag = `[EDITED:CRITICAL on ${dateFormatted}] Location or identity updated by ${session.role.toLowerCase()}${existingNotes ? ` | ${existingNotes}` : ''}`;
        resubmissionData = {
          moderationStatus: 'PENDING_REVIEW',
          isPublished: false,
          moderationNotes: editedTag,
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: {
              ...existingPending,
              status: 'PENDING_REVIEW',
              submittedAt: new Date().toISOString(),
              property: stagedPropertyChanges,
            },
          } as Prisma.InputJsonObject,
        };
      } else {
        // Non-critical content update (description, photos): keep published status live if already approved
        const editedTag = `[EDITED:MINOR on ${dateFormatted}] Photos or description updated by ${session.role.toLowerCase()}${existingNotes ? ` | ${existingNotes}` : ''}`;
        resubmissionData = {
          moderationStatus: property.moderationStatus === 'APPROVED' ? 'APPROVED' : 'PENDING_REVIEW',
          isPublished: property.isPublished,
          moderationNotes: editedTag,
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: {
              ...existingPending,
              status: 'PENDING_REVIEW',
              submittedAt: new Date().toISOString(),
              property: stagedPropertyChanges,
            },
          } as Prisma.InputJsonObject,
        };
      }
    }

    const addressChanged =
      cleanData.address !== undefined || cleanData.city !== undefined;
    const updated = await prisma.property.update({
      where: { id },
      data: {
        ...cleanData,
        ...(managerId ? { managerId } : {}),
        ...(landlordId ? { landlordId } : {}),
        ...(explicitMeta ? { metadata: explicitMeta as Prisma.InputJsonObject } : {}),
        ...resubmissionData,
        ...(addressChanged
          ? {
              listingHash: listingHash(
                cleanData.address ?? property.address,
                cleanData.city ?? property.city,
              ),
            }
          : {}),
      },
    });

    if (isLandlordOrManager && (isEditingCritical || isEditingContent)) {
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true, name: true },
        });
        const editor = await prisma.user.findUnique({
          where: { id: session.sub },
          select: { name: true, email: true, role: true },
        });
        const adminEmails = [
          ...new Set([...admins.map((a) => a.email), 'admin@proplity.com']),
        ];

        const subject = isEditingCritical
          ? `[CRITICAL REVIEW] Property Location/Identity Updated: ${updated.name}`
          : `[CONTENT UPDATE] Property Photos/Description Updated: ${updated.name}`;

        const body = isEditingCritical
          ? `Hi Admin,\n\nThe property listing "${updated.name}" had its address or identity modified by ${editor?.name ?? 'User'} (${editor?.email ?? ''}, ${editor?.role ?? ''}).\n\nBecause critical fields were edited, the listing has been temporarily UNPUBLISHED and resubmitted to PENDING_REVIEW.\n\nPlease inspect the changes in the Moderation Queue:\n${appUrl(`/admin/properties`, req)}`
          : `Hi Admin,\n\nThe property listing "${updated.name}" had its photos or description updated by ${editor?.name ?? 'User'} (${editor?.email ?? ''}, ${editor?.role ?? ''}).\n\nBecause these are non-critical content changes, the listing remains LIVE while awaiting review.\n\nReview the updated content in the Moderation Queue:\n${appUrl(`/admin/properties`, req)}`;

        for (const adminEmail of adminEmails) {
          await sendEmail({
            to: adminEmail,
            subject,
            body,
          });
        }
      } catch (err) {
        console.error('Failed to notify admins of edited property', err);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!canManageProperty(session, property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft-archive only -- never prisma.property.delete().
    const updated = await prisma.property.update({ where: { id }, data: { isPublished: false } });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});
