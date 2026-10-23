import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { managedIdsOf } from '@/lib/team';
import { propertyScopeWhere } from '@/lib/api/propertyAccess';

// "Needs your attention": one list of everything waiting on this person, so a dashboard does not
// have to be walked module by module. Each row is a kind of task with how many are waiting, the
// oldest or most urgent one named, and a link to the place that handles it. Rows with nothing
// waiting are left out, so an empty list means the person is up to date.

export type AttentionSeverity = 'high' | 'medium' | 'low';

export type AttentionItem = {
  /** Stable key for the kind of task. */
  id: string;
  label: string;
  count: number;
  /** The first waiting item, named, so the row says something concrete. */
  detail: string | null;
  href: string;
  severity: AttentionSeverity;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A rent is still being signed while it is PENDING, or when it was activated after one side
// signed (the signature card stays until both have). An ACTIVE rent nobody has signed is a
// record from before e-signature, not a task.
const awaitingSignatures: Prisma.RentWhereInput = {
  status: { in: ['PENDING', 'ACTIVE'] },
  OR: [{ status: 'PENDING' }, { signatures: { some: {} } }],
};
const SEVERITY_ORDER: Record<AttentionSeverity, number> = { high: 0, medium: 1, low: 2 };

function row(
  id: string,
  label: string,
  count: number,
  severity: AttentionSeverity,
  href: string,
  detail: string | null = null,
): AttentionItem[] {
  return count > 0 ? [{ id, label, count, detail, href, severity }] : [];
}

/** Messages in the caller's conversations that were sent by someone else and not yet read. */
async function unreadMessageCount(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS n
    FROM "Message" m
    JOIN "ConversationParticipant" cp
      ON cp."conversationId" = m."conversationId" AND cp."userId" = ${userId}
    WHERE m."senderId" IS DISTINCT FROM ${userId}
      AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
      AND (cp."leftAt" IS NULL OR m."createdAt" <= cp."leftAt")`);
  return Number(rows[0]?.n ?? 0);
}

async function teamAttention(userId: string, now: Date): Promise<AttentionItem[]> {
  const property = propertyScopeWhere(await managedIdsOf(userId));
  const inProperty = { unit: { property } };

  const [
    applications,
    viewings,
    unassigned,
    completedRepairs,
    disputedRepairs,
    transfers,
    overdue,
    pendingRents,
    endingRents,
    needChanges,
    unpublished,
    unread,
  ] = await Promise.all([
    prisma.application.findMany({
      where: { status: 'PENDING', ...inProperty },
      orderBy: { createdAt: 'asc' },
      select: {
        unit: { select: { unitNumber: true, property: { select: { id: true, name: true } } } },
      },
    }),
    prisma.propertyViewing.findMany({
      where: { status: 'REQUESTED', scheduledAt: { gt: now }, property },
      orderBy: { scheduledAt: 'asc' },
      select: { property: { select: { id: true, name: true } } },
    }),
    prisma.maintenanceRequest.findMany({
      where: { status: 'SUBMITTED', vendorId: null, ...inProperty },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        status: 'COMPLETED',
        ...inProperty,
        invoices: {
          some: { type: 'MAINTENANCE', status: { notIn: ['PAID', 'CANCELLED'] } },
        },
      },
      orderBy: { completedAt: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        status: 'COMPLETED',
        confirmationStatus: 'DISPUTED',
        approvedAt: null,
        ...inProperty,
      },
      orderBy: { confirmationRespondedAt: 'asc' },
      select: { id: true, title: true },
    }),
    // Transfers someone else recorded, waiting for this person (or an admin) to confirm.
    prisma.bankTransferSubmission.findMany({
      where: {
        status: 'PENDING',
        submittedById: { not: userId },
        invoice: { OR: [{ rent: inProperty }, { maintenanceRequest: inProperty }] },
      },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, invoice: { select: { invoiceNumber: true } } },
    }),
    prisma.invoice.findMany({
      where: { status: 'OVERDUE', rent: inProperty },
      orderBy: { dueDate: 'asc' },
      select: { invoiceNumber: true, amount: true },
    }),
    prisma.rent.findMany({
      where: { ...awaitingSignatures, agreementSignedAt: null, ...inProperty },
      orderBy: { createdAt: 'asc' },
      select: { id: true, unit: { select: { unitNumber: true } } },
    }),
    prisma.rent.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gt: now, lte: new Date(now.getTime() + 60 * MS_PER_DAY) },
        ...inProperty,
      },
      orderBy: { endDate: 'asc' },
      select: { id: true, unit: { select: { unitNumber: true } } },
    }),
    prisma.property.findMany({
      where: { ...property, moderationStatus: { in: ['REJECTED', 'FLAGGED'] } },
      select: { id: true, name: true },
    }),
    prisma.property.findMany({
      where: { ...property, moderationStatus: 'APPROVED', isPublished: false },
      select: { id: true, name: true },
    }),
    unreadMessageCount(userId),
  ]);

  const firstProperty = (list: { id: string }[], fallback: string) =>
    list.length === 1 ? `/dashboard/properties/${list[0].id}` : fallback;

  return [
    ...row(
      'repairs-disputed',
      'Repairs the tenant says are not fixed',
      disputedRepairs.length,
      'high',
      disputedRepairs.length === 1
        ? `/dashboard/maintenance/${disputedRepairs[0].id}`
        : '/dashboard/maintenance',
      disputedRepairs[0]?.title,
    ),
    ...row(
      'transfers-to-confirm',
      'Bank transfers to confirm',
      transfers.length,
      'medium',
      '/dashboard/reconciliation',
      transfers[0]
        ? `${transfers[0].invoice.invoiceNumber}, ₦${transfers[0].amount.toLocaleString()}`
        : null,
    ),
    ...row(
      'repairs-to-pay',
      'Finished repairs with a vendor invoice to pay',
      completedRepairs.length,
      'high',
      completedRepairs.length === 1
        ? `/dashboard/maintenance/${completedRepairs[0].id}`
        : '/dashboard/maintenance',
      completedRepairs[0]?.title,
    ),
    ...row(
      'rent-overdue',
      'Overdue invoices',
      overdue.length,
      'high',
      '/dashboard/breakdown/rent',
      overdue[0] ? `${overdue[0].invoiceNumber}, ₦${overdue[0].amount.toLocaleString()}` : null,
    ),
    ...row(
      'listings-need-changes',
      'Listings that need changes',
      needChanges.length,
      'high',
      firstProperty(needChanges, '/dashboard/properties'),
      needChanges[0]?.name,
    ),
    ...row(
      'applications',
      'Applications to review',
      applications.length,
      'medium',
      firstProperty(
        applications.map((a) => a.unit.property),
        '/dashboard/properties',
      ),
      applications[0]
        ? `Unit ${applications[0].unit.unitNumber}, ${applications[0].unit.property.name}`
        : null,
    ),
    ...row(
      'viewings',
      'Viewing requests to answer',
      viewings.length,
      'medium',
      firstProperty(
        viewings.map((v) => v.property),
        '/dashboard/properties',
      ),
      viewings[0]?.property.name,
    ),
    ...row(
      'repairs-unassigned',
      'Repair requests with no vendor',
      unassigned.length,
      'medium',
      unassigned.length === 1
        ? `/dashboard/maintenance/${unassigned[0].id}`
        : '/dashboard/maintenance',
      unassigned[0]?.title,
    ),
    ...row(
      'rents-unsigned',
      'Rents waiting for signatures',
      pendingRents.length,
      'medium',
      pendingRents.length === 1 ? `/dashboard/tenants/${pendingRents[0].id}` : '/dashboard/tenants',
      pendingRents[0] ? `Unit ${pendingRents[0].unit.unitNumber}` : null,
    ),
    ...row(
      'unread-messages',
      `Unread ${unread === 1 ? 'message' : 'messages'}`,
      unread,
      'medium',
      '/dashboard/messages',
    ),
    ...row(
      'rents-ending',
      'Rents ending within 60 days',
      endingRents.length,
      'low',
      endingRents.length === 1 ? `/dashboard/tenants/${endingRents[0].id}` : '/dashboard/tenants',
      endingRents[0] ? `Unit ${endingRents[0].unit.unitNumber}` : null,
    ),
    ...row(
      'listings-unpublished',
      'Approved listings not yet published',
      unpublished.length,
      'low',
      firstProperty(unpublished, '/dashboard/properties'),
      unpublished[0]?.name,
    ),
  ];
}

const TENANT_PROFILE_FIELDS = [
  'phoneNumber',
  'yearOfBirth',
  'emergencyContactName',
  'emergencyContactRelationship',
  'emergencyContactPhone',
  'idDocumentUrl',
] as const;

async function tenantAttention(userId: string, now: Date): Promise<AttentionItem[]> {
  const [user, unsigned, invoices, unrated, toConfirm, viewings, unread] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: Object.fromEntries(TENANT_PROFILE_FIELDS.map((f) => [f, true])) as Record<
        (typeof TENANT_PROFILE_FIELDS)[number],
        true
      >,
    }),
    prisma.rent.findMany({
      where: {
        tenantId: userId,
        ...awaitingSignatures,
        signatures: { none: { signerId: userId } },
      },
      select: { unit: { select: { unitNumber: true, property: { select: { name: true } } } } },
    }),
    prisma.invoice.findMany({
      where: {
        OR: [{ rent: { tenantId: userId } }, { userId }],
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueDate: { lte: new Date(now.getTime() + 7 * MS_PER_DAY) },
      },
      orderBy: { dueDate: 'asc' },
      select: { invoiceNumber: true, amount: true, status: true, dueDate: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: { tenantId: userId, status: 'COMPLETED', vendorId: { not: null }, vendorRating: null },
      orderBy: { completedAt: 'desc' },
      select: { title: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: { tenantId: userId, status: 'COMPLETED', confirmationStatus: 'AWAITING_TENANT' },
      orderBy: { completedAt: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.propertyViewing.findMany({
      where: { requestedById: userId, status: 'CONFIRMED', scheduledAt: { gt: now } },
      orderBy: { scheduledAt: 'asc' },
      select: { scheduledAt: true, property: { select: { name: true } } },
    }),
    unreadMessageCount(userId),
  ]);

  const missing = user
    ? TENANT_PROFILE_FIELDS.filter(
        (f) => user[f] === null || user[f] === undefined || user[f] === '',
      )
    : [];
  const overdue = invoices.filter((i) => i.status === 'OVERDUE');
  const dueSoon = invoices.filter((i) => i.status !== 'OVERDUE');

  return [
    ...row(
      'rent-to-sign',
      'Rent to sign',
      unsigned.length,
      'high',
      '/dashboard',
      unsigned[0] ? `Unit ${unsigned[0].unit.unitNumber}, ${unsigned[0].unit.property.name}` : null,
    ),
    ...row(
      'repairs-to-confirm',
      'Repairs to confirm',
      toConfirm.length,
      'high',
      toConfirm.length === 1
        ? `/dashboard/tenant-maintenance?request=${toConfirm[0].id}`
        : '/dashboard/tenant-maintenance',
      toConfirm[0]?.title,
    ),
    ...row(
      'invoices-overdue',
      'Overdue payments',
      overdue.length,
      'high',
      '/dashboard/payment-history',
      overdue[0] ? `${overdue[0].invoiceNumber}, ₦${overdue[0].amount.toLocaleString()}` : null,
    ),
    ...row(
      'invoices-due',
      'Payments due this week',
      dueSoon.length,
      'medium',
      '/dashboard/payment-history',
      dueSoon[0] ? `${dueSoon[0].invoiceNumber}, due ${dueSoon[0].dueDate.toDateString()}` : null,
    ),
    ...row(
      'repairs-to-rate',
      'Finished repairs to rate',
      unrated.length,
      'low',
      '/dashboard/tenant-maintenance',
      unrated[0]?.title,
    ),
    ...row(
      'profile-incomplete',
      'Profile to finish',
      missing.length,
      'medium',
      '/dashboard/settings?tab=completion',
      `${TENANT_PROFILE_FIELDS.length - missing.length} of ${TENANT_PROFILE_FIELDS.length} details filled in`,
    ),
    ...row(
      'unread-messages',
      `Unread ${unread === 1 ? 'message' : 'messages'}`,
      unread,
      'medium',
      '/dashboard/messages',
    ),
    ...row(
      'viewings-upcoming',
      'Upcoming viewings',
      viewings.length,
      'low',
      '/dashboard/discover',
      viewings[0]
        ? `${viewings[0].property.name}, ${viewings[0].scheduledAt.toDateString()}`
        : null,
    ),
  ];
}

async function vendorAttention(userId: string): Promise<AttentionItem[]> {
  const [profile, assigned, inProgress, toInvoice, unpaid, unread] = await Promise.all([
    prisma.vendorProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: { vendorId: userId, status: 'SCHEDULED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: { vendorId: userId, status: 'IN_PROGRESS' },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, title: true, disputeReason: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        vendorId: userId,
        status: 'COMPLETED',
        invoices: { none: { type: 'MAINTENANCE', status: { not: 'CANCELLED' } } },
      },
      select: { id: true, title: true },
    }),
    prisma.invoice.findMany({
      where: {
        type: 'MAINTENANCE',
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        maintenanceRequest: { vendorId: userId },
      },
      orderBy: { createdAt: 'asc' },
      select: { invoiceNumber: true, amount: true },
    }),
    unreadMessageCount(userId),
  ]);

  const job = (list: { id: string }[]) =>
    list.length === 1 ? `/dashboard/vendor/jobs/${list[0].id}` : '/dashboard';
  // A repair the property team sent back keeps the tenant's reason until it is finished again.
  const sentBack = inProgress.filter((j) => j.disputeReason);
  const active = inProgress.filter((j) => !j.disputeReason);

  return [
    ...row(
      'vendor-verification',
      'Your vendor account is not verified yet',
      profile && profile.verificationStatus !== 'VERIFIED' ? 1 : 0,
      'high',
      '/dashboard/settings?tab=completion',
      profile?.verificationStatus === 'REJECTED'
        ? 'Verification was declined. Update your details.'
        : 'An admin is reviewing your details.',
    ),
    ...row(
      'jobs-sent-back',
      'Repairs sent back to you',
      sentBack.length,
      'high',
      job(sentBack),
      sentBack[0]?.title,
    ),
    ...row(
      'jobs-to-invoice',
      'Finished jobs with no invoice',
      toInvoice.length,
      'high',
      toInvoice.length === 1 ? `/dashboard/vendor/jobs/${toInvoice[0].id}/invoice` : '/dashboard',
      toInvoice[0]?.title,
    ),
    ...row(
      'jobs-new',
      'New jobs to start',
      assigned.length,
      'medium',
      job(assigned),
      assigned[0]?.title,
    ),
    ...row(
      'unread-messages',
      `Unread ${unread === 1 ? 'message' : 'messages'}`,
      unread,
      'medium',
      '/dashboard/messages',
    ),
    ...row('jobs-active', 'Jobs in progress', active.length, 'low', job(active), active[0]?.title),
    ...row(
      'invoices-unpaid',
      'Invoices waiting to be paid',
      unpaid.length,
      'low',
      '/dashboard/vendor/invoices',
      unpaid[0] ? `${unpaid[0].invoiceNumber}, ₦${unpaid[0].amount.toLocaleString()}` : null,
    ),
  ];
}

async function adminAttention(userId: string): Promise<AttentionItem[]> {
  const [listings, vendors, overdue, transfers] = await Promise.all([
    prisma.property.findMany({
      where: { moderationStatus: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'asc' },
      select: { name: true },
    }),
    prisma.vendorProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { businessName: true },
    }),
    prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    prisma.bankTransferSubmission.findMany({
      where: { status: 'PENDING', submittedById: { not: userId } },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, invoice: { select: { invoiceNumber: true } } },
    }),
  ]);

  return [
    ...row(
      'admin-listings',
      'Listings awaiting review',
      listings.length,
      'high',
      '/admin/properties',
      listings[0]?.name,
    ),
    ...row(
      'admin-vendors',
      'Vendors awaiting verification',
      vendors.length,
      'high',
      '/admin/users',
      vendors[0]?.businessName,
    ),
    ...row(
      'admin-transfers',
      'Bank transfers to confirm',
      transfers.length,
      'medium',
      '/admin/payments',
      transfers[0]
        ? `${transfers[0].invoice.invoiceNumber}, ₦${transfers[0].amount.toLocaleString()}`
        : null,
    ),
    ...row(
      'admin-overdue',
      'Overdue invoices across the platform',
      overdue,
      'medium',
      '/admin/reports',
    ),
  ];
}

export async function attentionFor(
  userId: string,
  role: Role,
  now = new Date(),
): Promise<AttentionItem[]> {
  const items =
    role === 'TENANT'
      ? await tenantAttention(userId, now)
      : role === 'VENDOR'
        ? await vendorAttention(userId)
        : role === 'ADMIN'
          ? await adminAttention(userId)
          : await teamAttention(userId, now);

  // Most urgent first; within a level, the biggest pile first.
  return items.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count,
  );
}
