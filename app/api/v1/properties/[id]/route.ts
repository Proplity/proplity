import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty, isPublicUnit, serializeUnit } from '@/lib/api/propertyAccess';
import { sessionOrNull } from '@/lib/api/listingAccess';
import { safeUrl, safeUrlList } from '@/lib/api/urlField';
import { listingHash, findPossibleDuplicates } from '@/lib/propertyFingerprint';
import { sendEmail } from '@/lib/email';
import { notifyAdmins as notifyAdminsInApp } from '@/lib/notifications';
import { appUrl } from '@/lib/appUrl';
import { moveStaffInPropertyThreads } from '@/lib/conversationAccess';
import { reviewerKind } from '@/lib/reviewEligibility';
import {
  STAGED_PROPERTY_FIELDS,
  pickStaged,
  touchesCritical,
  readRestoreTo,
  type RestoreTo,
} from '@/lib/propertyPendingChanges';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Visibility, in three tiers. This route stays *optionally* authenticated --
 * PublicPropertyDetail browses it logged-out and must keep working -- but an
 * unpublished listing is no longer readable by anyone who merely knows the id.
 *
 * A property is readable when ANY of these hold:
 *   1. it is published AND approved (the public tier -- mirrors the list
 *      endpoint's filter. `isPublished` can only be flipped true after ADMIN
 *      approval, see PATCH below, but both pages also check the approval
 *      status so a row that is published and still pending (bad data) never
 *      shows up publicly);
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

    const session = await sessionOrNull();
    const manages = !!session && canManageProperty(session, property);
    // Any rent at all, not just ACTIVE: a tenant mid-renewal or just past
    // their end date still needs the property's announcements and their own
    // unit's history.
    const occupancy =
      session && !manages
        ? await prisma.rent.findFirst({
            where: { tenantId: session.sub, unit: { propertyId: id } },
            select: { id: true },
          })
        : null;

    if (!property.isPublished || property.moderationStatus !== 'APPROVED') {
      if (!manages && occupancy === null) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
    }

    // A unit marked private is for the owner's side and the people living in the
    // building only; everyone else gets the public units (ISS-084).
    const seesPrivate = manages || occupancy !== null;
    const visibleUnits = seesPrivate ? property.units : property.units.filter(isPublicUnit);
    if (!seesPrivate && property.units.length > 0 && visibleUnits.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    property.units = visibleUnits;

    const { reviews, units, ...rest } = property;
    const ratings = reviews.map((r) => r.rating);
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    return NextResponse.json({
      data: {
        ...rest,
        units: units.map(serializeUnit),
        reviews: reviews.map((r) => ({
          ...r,
          verified: r.rentId !== null,
          kind: reviewerKind(r),
        })),
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
  // Whether the property is kept for tenant management only (never listed, never reviewed). Sent
  // on its own: false lists it (it then waits for an admin's approval), true takes it off the market.
  managementOnly: z.boolean().optional(),
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
      // A company's managing partner may hand a property they run to someone on their own team.
      const partnerHandover =
        session.role === 'MANAGER' &&
        !!session.org?.isOwner &&
        validated.data.landlordId === undefined &&
        !!validated.data.managerId &&
        session.org.memberIds.includes(validated.data.managerId);
      if (session.role !== 'ADMIN' && !partnerHandover) {
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

    // Moving between "management only" and "listed" is its own step, so it never mixes with an
    // ordinary edit that might need the review rules below.
    if (validated.data.managementOnly !== undefined) {
      const { managementOnly, ...others } = validated.data;
      if (Object.values(others).some((v) => v !== undefined)) {
        return NextResponse.json(
          { error: 'Change whether a property is listed on its own, without other edits' },
          { status: 400 },
        );
      }
      if (managementOnly === property.managementOnly) {
        return NextResponse.json({ data: property });
      }
      if (managementOnly) {
        // Off the market: it stops being a listing, so it also stops waiting for or being shown.
        const updated = await prisma.property.update({
          where: { id },
          data: { managementOnly: true, isPublished: false },
        });
        return NextResponse.json({ data: updated });
      }
      // Onto the market: it is compared with the existing listings and sent for review like any
      // new listing, and its units are only shown once an admin approves.
      const hash = listingHash(property.address, property.city);
      const duplicates = await findPossibleDuplicates(hash, property.id);
      const updated = await prisma.property.update({
        where: { id },
        data: {
          managementOnly: false,
          listingHash: hash,
          ...(duplicates.length > 0
            ? {
                moderationNotes: `Possible duplicate of: ${duplicates
                  .map((d) => `${d.name} (${d.id})`)
                  .join(', ')}`,
              }
            : {}),
        },
      });
      if (updated.moderationStatus === 'PENDING_REVIEW') {
        await notifyAdminsInApp({
          title: 'Listing awaiting review',
          body: `"${updated.name}" (${updated.address}, ${updated.city}) was submitted for review.`,
          link: '/admin/properties',
        });
      }
      return NextResponse.json({ data: updated, possibleDuplicates: duplicates.length });
    }

    if (validated.data.isPublished === true && property.managementOnly) {
      return NextResponse.json(
        {
          error: 'This property is kept for management only. List it publicly before publishing it',
          code: 'MANAGEMENT_ONLY',
        },
        { status: 409 },
      );
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

    const currentPropertyMeta = ((property.metadata as Record<string, unknown> | null) ||
      {}) as Record<string, unknown>;
    const existingPending = (currentPropertyMeta.pendingChanges as Record<string, unknown>) || null;
    const stripEdited = (notes: string | null) =>
      (notes || '').replace(/\[EDITED[^\]]*\]\s*/g, '').trim();
    // The edit form sends every field it shows, changed or not. Only a field that
    // differs from the live listing is a real edit: an untouched name or address
    // must not make a description edit look like a change of identity or location.
    const sameAsLive = (key: string, value: unknown) =>
      JSON.stringify((property as Record<string, unknown>)[key] ?? null) ===
      JSON.stringify(value ?? null);
    const onlyChanged = (fields: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(fields).filter(([k, v]) => !sameAsLive(k, v)));
    const editedTag = (critical: boolean) => {
      const date = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const rest = stripEdited(property.moderationNotes);
      return critical
        ? `[EDITED:CRITICAL on ${date}] Location or identity updated by ${session.role.toLowerCase()}${rest ? ` | ${rest}` : ''}`
        : `[EDITED:MINOR on ${date}] Photos or description updated by ${session.role.toLowerCase()}${rest ? ` | ${rest}` : ''}`;
    };
    // Where to return the listing if the owner cancels the review request: only an
    // approved listing has anything to go back to (ISS-059).
    const restoreToFor = (): RestoreTo | undefined =>
      readRestoreTo(existingPending) ??
      (property.moderationStatus === 'APPROVED'
        ? { moderationStatus: 'APPROVED', isPublished: property.isPublished }
        : undefined);

    const notifyAdmins = async (subject: string, body: string) => {
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true },
        });
        for (const email of new Set(admins.map((a) => a.email))) {
          await sendEmail({ to: email, subject, body });
        }
      } catch (err) {
        console.error('Failed to notify admins of a property edit', err);
      }
    };
    const editorLabel = async () => {
      const editor = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { name: true, email: true, role: true },
      });
      return `${editor?.name ?? 'User'} (${editor?.email ?? ''}, ${editor?.role ?? ''})`;
    };

    // 1. CANCEL PENDING EDITS: move the edits back to DRAFT and, if the listing was
    // approved before the edit, return it to that state. Never raises a listing.
    if (validated.data.cancelPendingEdits) {
      if (!existingPending) {
        return NextResponse.json({ data: property, message: 'No pending edits to cancel' });
      }
      const restoreTo = readRestoreTo(existingPending);
      const now = new Date().toISOString();
      const restored = await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: {
              ...existingPending,
              status: 'DRAFT',
              updatedAt: now,
              cancelledAt: now,
            },
          } as Prisma.InputJsonObject,
          moderationNotes: stripEdited(property.moderationNotes) || null,
          ...(restoreTo
            ? { moderationStatus: restoreTo.moderationStatus, isPublished: restoreTo.isPublished }
            : {}),
        },
      });
      return NextResponse.json({
        data: restored,
        message: 'Approval request cancelled. Edits moved back to draft.',
      });
    }

    // 2. DELETE PENDING EDITS (discard a draft). Edits under review must be cancelled first.
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
      const { pendingChanges: _removed, ...restMeta } = currentPropertyMeta;
      const restored = await prisma.property.update({
        where: { id },
        data: {
          metadata: restMeta as Prisma.InputJsonObject,
          moderationNotes: stripEdited(property.moderationNotes) || null,
        },
      });
      return NextResponse.json({ data: restored, message: 'Draft edits deleted successfully.' });
    }

    // 3. SUBMIT DRAFT FOR REVIEW
    if (validated.data.submitForReview) {
      // The edit form saves and submits in one call, so fields sent with the flag
      // are staged first; a bare flag submits the draft saved earlier.
      const sentFields = onlyChanged(pickStaged(validated.data));
      const draftToSubmit =
        Object.keys(sentFields).length > 0
          ? {
              ...(existingPending || {}),
              property: {
                ...((existingPending?.property as Record<string, unknown>) || {}),
                ...sentFields,
              },
            }
          : existingPending;
      if (!draftToSubmit) {
        return NextResponse.json(
          { error: 'No draft edits found to submit for review', code: 'NO_DRAFT' },
          { status: 400 },
        );
      }
      const draftProp = (draftToSubmit.property as Record<string, unknown>) || {};
      const isCritical = touchesCritical(draftProp);
      const restoreTo = restoreToFor();

      const updated = await prisma.property.update({
        where: { id },
        data: {
          metadata: {
            ...currentPropertyMeta,
            pendingChanges: {
              ...draftToSubmit,
              status: 'PENDING_REVIEW',
              submittedAt: new Date().toISOString(),
              ...(restoreTo ? { restoreTo } : {}),
            },
          } as Prisma.InputJsonObject,
          moderationNotes: editedTag(isCritical),
          ...(isCritical ? { moderationStatus: 'PENDING_REVIEW', isPublished: false } : {}),
        },
      });

      await notifyAdminsInApp({
        title: isCritical ? 'Critical edit awaiting review' : 'Listing edit awaiting review',
        body: `Edits to "${updated.name}" were submitted for review.`,
        link: '/admin/properties',
      });
      await notifyAdmins(
        isCritical
          ? `[CRITICAL REVIEW] Property Location/Identity Updated: ${updated.name}`
          : `[CONTENT UPDATE] Property Photos/Description Updated: ${updated.name}`,
        `Hi Admin,\n\nThe property listing "${updated.name}" had its draft edits submitted for review by ${await editorLabel()}.\n\n${isCritical ? 'Because critical fields were edited, the listing has been temporarily UNPUBLISHED and resubmitted to PENDING_REVIEW.' : 'The listing remains LIVE while awaiting review.'}\n\nPlease inspect the changes in the Moderation Queue:\n${appUrl(`/admin/properties`, req)}`,
      );
      return NextResponse.json({ data: updated, message: 'Draft edits submitted for review.' });
    }

    // 4. SAVE AS DRAFT: staged only, nothing changes on the live listing.
    if (validated.data.saveAsDraft) {
      const draftProp = (existingPending?.property as Record<string, unknown>) || {};
      const updatedPending = {
        ...(existingPending || {}),
        status: 'DRAFT',
        updatedAt: new Date().toISOString(),
        property: onlyChanged({ ...draftProp, ...pickStaged(validated.data) }),
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

    // 5. DIRECT EDIT
    const {
      saveAsDraft: _draftFlag,
      submitForReview: _submitFlag,
      cancelPendingEdits: _cancelFlag,
      deletePendingEdits: _deleteFlag,
      managerId,
      landlordId,
      ...cleanData
    } = validated.data;

    const stagedFields = onlyChanged(pickStaged(cleanData));
    const hasStagedEdit = Object.keys(stagedFields).length > 0;
    const isOwnerEdit = session.role !== 'ADMIN';
    const critical = touchesCritical(stagedFields);

    // An owner's edit to an APPROVED listing is staged for review and does not touch
    // the live row until an admin approves it (ISS-061). On a listing that is not
    // approved nothing is public yet, so the edit applies directly; a rejected or
    // flagged listing goes back to the queue.
    const stageForReview = isOwnerEdit && hasStagedEdit && property.moderationStatus === 'APPROVED';
    const resubmit =
      isOwnerEdit &&
      hasStagedEdit &&
      !stageForReview &&
      (property.moderationStatus === 'REJECTED' || property.moderationStatus === 'FLAGGED');

    const liveData: Record<string, unknown> = { ...cleanData };
    let reviewData: Record<string, unknown> = {};
    if (stageForReview) {
      for (const key of STAGED_PROPERTY_FIELDS) delete liveData[key];
      const restoreTo = restoreToFor();
      reviewData = {
        moderationNotes: editedTag(critical),
        ...(critical ? { moderationStatus: 'PENDING_REVIEW', isPublished: false } : {}),
        metadata: {
          ...currentPropertyMeta,
          pendingChanges: {
            ...(existingPending || {}),
            status: 'PENDING_REVIEW',
            submittedAt: new Date().toISOString(),
            property: {
              ...((existingPending?.property as Record<string, unknown>) || {}),
              ...stagedFields,
            },
            ...(restoreTo ? { restoreTo } : {}),
          },
        } as Prisma.InputJsonObject,
      };
    } else if (resubmit) {
      reviewData = {
        moderationStatus: 'PENDING_REVIEW',
        isPublished: false,
        moderationNotes: editedTag(critical),
      };
    }

    const addressChanged =
      !stageForReview && (cleanData.address !== undefined || cleanData.city !== undefined);

    // Moving a property to another manager or landlord changes who can see its tenants and
    // money, so it is audit-logged (ISS-135): who did it, and from whom to whom. Naming the same
    // person again is not a transfer.
    const managerMoved = !!managerId && managerId !== property.managerId;
    const landlordMoved = !!landlordId && landlordId !== property.landlordId;
    const people =
      managerMoved || landlordMoved
        ? await prisma.user.findMany({
            where: {
              id: {
                in: [property.managerId, managerId, property.landlordId, landlordId].filter(
                  (v): v is string => !!v,
                ),
              },
            },
            select: { id: true, name: true },
          })
        : [];
    const nameOf = (userId: string | null | undefined) =>
      userId ? (people.find((p) => p.id === userId)?.name ?? null) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.property.update({
        where: { id },
        data: {
          ...liveData,
          ...(managerId ? { managerId } : {}),
          ...(landlordId ? { landlordId } : {}),
          ...reviewData,
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
      if (managerMoved || landlordMoved) {
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'PROPERTY_TRANSFERRED',
            entityType: 'Property',
            entityId: id,
            metadata: {
              propertyName: property.name,
              ...(managerMoved
                ? {
                    manager: {
                      from: property.managerId,
                      fromName: nameOf(property.managerId),
                      to: managerId,
                      toName: nameOf(managerId),
                    },
                  }
                : {}),
              ...(landlordMoved
                ? {
                    landlord: {
                      from: property.landlordId,
                      fromName: nameOf(property.landlordId),
                      to: landlordId,
                      toName: nameOf(landlordId),
                    },
                  }
                : {}),
            },
          },
        });
      }
      // The people who lost the property leave its message threads and the new ones join (ISS-142).
      if (managerMoved || landlordMoved) {
        await moveStaffInPropertyThreads(tx, {
          propertyId: id,
          removed: [
            ...(managerMoved ? [property.managerId] : []),
            ...(landlordMoved ? [property.landlordId] : []),
          ].filter((v): v is string => !!v),
          added: [
            ...(managerMoved ? [managerId] : []),
            ...(landlordMoved ? [landlordId] : []),
          ].filter((v): v is string => !!v),
          current: [row.managerId, row.landlordId],
        });
      }
      return row;
    });

    if (stageForReview || resubmit) {
      await notifyAdminsInApp({
        title: critical ? 'Critical edit awaiting review' : 'Listing edit awaiting review',
        body: `Edits to "${updated.name}" were submitted for review.`,
        link: '/admin/properties',
      });
      await notifyAdmins(
        critical
          ? `[CRITICAL REVIEW] Property Location/Identity Updated: ${updated.name}`
          : `[CONTENT UPDATE] Property Photos/Description Updated: ${updated.name}`,
        `Hi Admin,\n\nThe property listing "${updated.name}" was edited by ${await editorLabel()}.\n\n${critical ? 'Because critical fields were edited, the listing has been temporarily UNPUBLISHED and resubmitted to PENDING_REVIEW.' : 'The edits are held for review and the listing stays as it was until you approve them.'}\n\nPlease inspect the changes in the Moderation Queue:\n${appUrl(`/admin/properties`, req)}`,
      );
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
