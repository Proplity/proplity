import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Who stays in a message thread follows the link that put them there (ISS-142).
 *
 * - A tenant whose tenancy ends keeps reading the thread up to that moment but cannot post and
 *   sees nothing newer (`leftAt`): the record of their own rent and repairs is theirs to keep.
 * - A manager or landlord who loses a property is taken out of its threads entirely, and the new
 *   ones are added, so the people who no longer run the property stop reading about it.
 */

/**
 * The rent's tenancy has ended. Their rent thread, and the property's community boards when it
 * was their last tenancy there, become read-only. Does nothing while they still hold another
 * active rent on the unit (a renewal starts the new rent before the old one ends).
 */
export async function closeThreadsWhenTenancyEnds(
  tx: Tx,
  rent: { id: string; unitId: string; tenantId: string; propertyId: string },
): Promise<void> {
  const stillOnUnit = await tx.rent.findFirst({
    where: {
      unitId: rent.unitId,
      tenantId: rent.tenantId,
      status: 'ACTIVE',
      id: { not: rent.id },
    },
    select: { id: true },
  });
  if (stillOnUnit) return;

  const now = new Date();
  await tx.conversationParticipant.updateMany({
    where: { userId: rent.tenantId, leftAt: null, conversation: { rentId: rent.id } },
    data: { leftAt: now },
  });

  const stillOnProperty = await tx.rent.findFirst({
    where: {
      tenantId: rent.tenantId,
      status: 'ACTIVE',
      id: { not: rent.id },
      unit: { propertyId: rent.propertyId },
    },
    select: { id: true },
  });
  if (stillOnProperty) return;
  await tx.conversationParticipant.updateMany({
    where: {
      userId: rent.tenantId,
      leftAt: null,
      conversation: { type: 'COMMUNITY_DISCUSSION', propertyId: rent.propertyId },
    },
    data: { leftAt: now },
  });
}

/** A rent that had ended was set active again: the tenant can post in its threads once more. */
export async function reopenThreadsWhenTenancyResumes(
  tx: Tx,
  rent: { id: string; tenantId: string; propertyId: string },
): Promise<void> {
  await tx.conversationParticipant.updateMany({
    where: {
      userId: rent.tenantId,
      leftAt: { not: null },
      conversation: {
        OR: [{ rentId: rent.id }, { type: 'COMMUNITY_DISCUSSION', propertyId: rent.propertyId }],
      },
    },
    data: { leftAt: null },
  });
}

/**
 * A property moved to another manager or landlord. The people who lost it leave every thread of
 * the property (its community boards, rent threads and repair threads) and the people who took it
 * over join them. Someone who is still part of a thread for another reason (the tenant or the
 * vendor of that rent or repair) or who still runs the property is left alone.
 */
export async function moveStaffInPropertyThreads(
  tx: Tx,
  move: {
    propertyId: string;
    removed: string[];
    added: string[];
    /** Who runs the property after the move. */
    current: (string | null)[];
  },
): Promise<void> {
  const stillRuns = new Set(move.current.filter((v): v is string => !!v));
  const removed = move.removed.filter((id) => !stillRuns.has(id));
  const added = move.added.filter((id) => stillRuns.has(id));
  if (removed.length === 0 && added.length === 0) return;

  const threads = await tx.conversation.findMany({
    where: {
      OR: [
        { propertyId: move.propertyId },
        { rent: { unit: { propertyId: move.propertyId } } },
        { maintenanceRequest: { unit: { propertyId: move.propertyId } } },
      ],
    },
    select: {
      id: true,
      rent: { select: { tenantId: true } },
      maintenanceRequest: { select: { tenantId: true, vendorId: true } },
    },
  });

  for (const thread of threads) {
    const otherRoles = new Set(
      [
        thread.rent?.tenantId,
        thread.maintenanceRequest?.tenantId,
        thread.maintenanceRequest?.vendorId,
      ].filter((v): v is string => !!v),
    );
    const leaving = removed.filter((id) => !otherRoles.has(id));
    if (leaving.length > 0) {
      await tx.conversationParticipant.deleteMany({
        where: { conversationId: thread.id, userId: { in: leaving } },
      });
    }
    if (added.length > 0) {
      await tx.conversationParticipant.createMany({
        data: added.map((userId) => ({ conversationId: thread.id, userId })),
        skipDuplicates: true,
      });
    }
  }
}
