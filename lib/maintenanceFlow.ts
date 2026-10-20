import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/systemSettings';
import { getStorage } from '@/lib/storage';
import { notifyAndEmail, notifyUser, type NotifyRequest } from '@/lib/notifications';

// Rules shared by the places that finish, review or hand over a repair: the vendor's PATCH, the
// vendor's invoice (which completes the job), the tenant's confirmation and the manager's review.

export { MAX_EVIDENCE_PHOTOS } from '@/lib/repairEvidence';

/** States from which a repair can still be started, finished or cancelled. */
export const OPEN_STATUSES = ['SUBMITTED', 'SCHEDULED', 'IN_PROGRESS'] as const;

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

/**
 * A job can be closed once the vendor has shown the finished work. The single completion proof
 * link that existed before the photo lists still counts.
 */
export function hasCompletionEvidence(r: {
  afterPhotoUrls: string[];
  completionProofUrl: string | null;
}): boolean {
  return r.afterPhotoUrls.length > 0 || Boolean(r.completionProofUrl);
}

/**
 * Photos are asked for only where they can be uploaded. With no storage provider configured a vendor
 * has no way to attach one, so requiring it would make every job impossible to close.
 */
export function evidenceRequired(): boolean {
  try {
    return getStorage().isConfigured();
  } catch {
    return false;
  }
}

/** True when the finished work must be shown and has not been. */
export function lacksEvidence(r: {
  afterPhotoUrls: string[];
  completionProofUrl: string | null;
}): boolean {
  return evidenceRequired() && !hasCompletionEvidence(r);
}

export const EVIDENCE_REQUIRED = {
  error: 'Add at least one photo of the finished work before closing this job.',
  code: 'EVIDENCE_REQUIRED',
} as const;

/**
 * What to write when a vendor finishes (or finishes again) a job: the completion time, whether the
 * tenant is asked to confirm (the admin switch), and a clean slate for any earlier answer.
 * `disputeReason` is cleared here, not when the job is sent back, so the vendor can read it while
 * they redo the work. A repair with no tenant (a work order the property team raised) has nobody to
 * ask, so it is never left waiting for an answer.
 */
export async function completionData(request: {
  tenantId: string | null;
}): Promise<
  Pick<
    Prisma.MaintenanceRequestUncheckedUpdateInput,
    | 'status'
    | 'completedAt'
    | 'confirmationStatus'
    | 'confirmationRespondedAt'
    | 'disputeReason'
    | 'disputePhotoUrls'
    | 'approvedAt'
    | 'approvedById'
  >
> {
  const { requireTenantRepairConfirmation } = await getSystemSettings();
  return {
    status: 'COMPLETED',
    completedAt: new Date(),
    confirmationStatus:
      requireTenantRepairConfirmation && request.tenantId ? 'AWAITING_TENANT' : 'NOT_REQUESTED',
    confirmationRespondedAt: null,
    disputeReason: null,
    disputePhotoUrls: [],
    approvedAt: null,
    approvedById: null,
  };
}

/** Where a tenant opens one of their own repairs. */
export function tenantRepairLink(requestId: string): string {
  return `/dashboard/tenant-maintenance?request=${requestId}`;
}

/** Tell the tenant their repair is done, asking for an answer when one is wanted. Nobody to tell on a work order. */
export async function tellTenantRepairDone(
  request: { id: string; tenantId: string | null; title: string },
  awaitingTenant: boolean,
  req?: NotifyRequest,
) {
  if (!request.tenantId) return;
  if (awaitingTenant) {
    await notifyAndEmail(
      request.tenantId,
      {
        type: 'MAINTENANCE_STATUS',
        title: 'Is your repair fixed?',
        body: `The vendor completed "${request.title}". Open it to confirm it is fixed, or tell us if it is still a problem.`,
        link: tenantRepairLink(request.id),
      },
      { req },
    );
    return;
  }
  await notifyUser(request.tenantId, {
    type: 'MAINTENANCE_STATUS',
    title: `Maintenance update: ${request.title}`,
    body: `Your request "${request.title}" has been completed.`,
    link: `/dashboard/maintenance/${request.id}`,
  });
}

/**
 * Only a vetted vendor can take a job (ISS-043). A vendor with no profile row predates sign-up
 * profiles and is still allowed. Returns a response to send when the vendor cannot be used.
 */
export async function vendorProblem(vendorId: string): Promise<NextResponse | null> {
  const vendor = await prisma.user.findFirst({
    where: { id: vendorId, role: 'VENDOR' },
    include: { vendorProfile: { select: { verificationStatus: true } } },
  });
  if (!vendor) {
    return NextResponse.json({ error: 'vendorId must reference a vendor' }, { status: 400 });
  }
  if (vendor.vendorProfile && vendor.vendorProfile.verificationStatus !== 'VERIFIED') {
    return NextResponse.json(
      { error: 'This vendor has not been verified yet', code: 'VENDOR_NOT_VERIFIED' },
      { status: 409 },
    );
  }
  return null;
}

/**
 * Keeps a repair's message thread in step with who is on the job. The thread is created once, from
 * whoever was on the request that day, so a vendor assigned afterwards was never added (they could
 * not read or write in it), and a vendor taken off the job kept seeing the tenant's messages.
 * Does nothing when there is no thread yet; never throws.
 */
export async function syncThreadVendor(
  maintenanceRequestId: string,
  vendorId: string | null,
  previousVendorId: string | null = null,
) {
  try {
    const thread = await prisma.conversation.findUnique({
      where: { maintenanceRequestId },
      select: { id: true },
    });
    if (!thread) return;
    if (previousVendorId && previousVendorId !== vendorId) {
      await prisma.conversationParticipant.deleteMany({
        where: { conversationId: thread.id, userId: previousVendorId },
      });
    }
    if (vendorId) {
      await prisma.conversationParticipant.createMany({
        data: [{ conversationId: thread.id, userId: vendorId }],
        skipDuplicates: true,
      });
    }
  } catch (err) {
    console.error('syncThreadVendor failed', err);
  }
}
