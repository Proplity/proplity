import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type Db = Prisma.TransactionClient;

/**
 * Who a signed-in person works with. A company (Organisation) has a managing partner and members,
 * each with their own login. The partner manages every member's properties; what a member sees of
 * the others is the admin's choice (`teamMemberAccess`). Everyone else is alone.
 */
export type TeamScope = {
  organisationId: string | null;
  /** The account that pays for the company's plan. */
  ownerId: string | null;
  isOwner: boolean;
  /** Everyone in the company, the partner included; empty when there is no company. */
  memberIds: string[];
  /** The user ids whose properties this person may manage (always includes their own). */
  managedIds: string[];
  /** The account whose plan, units and credits this person's work counts against. */
  billingAccountId: string;
};

export async function getTeamScope(userId: string, db: Db = prisma): Promise<TeamScope> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      organisation: { select: { id: true, ownerId: true, members: { select: { id: true } } } },
    },
  });
  const org = user?.organisation;
  if (!org) {
    return {
      organisationId: null,
      ownerId: null,
      isOwner: false,
      memberIds: [],
      managedIds: [userId],
      billingAccountId: userId,
    };
  }
  const memberIds = org.members.map((m) => m.id);
  const isOwner = org.ownerId === userId;
  let managedIds = [userId];
  if (isOwner) {
    managedIds = memberIds;
  } else {
    const settings = await db.systemSettings.findUnique({
      where: { id: 'global' },
      select: { teamMemberAccess: true },
    });
    if (settings?.teamMemberAccess === 'ALL_COMPANY') managedIds = memberIds;
  }
  return {
    organisationId: org.id,
    ownerId: org.ownerId,
    isOwner,
    memberIds,
    managedIds,
    billingAccountId: org.ownerId,
  };
}

/** The user ids whose properties this person may manage. */
export async function managedIdsOf(userId: string, db: Db = prisma): Promise<string[]> {
  return (await getTeamScope(userId, db)).managedIds;
}

/** The account that pays for what this person does (the partner for a company member). */
export async function billingAccountOf(userId: string, db: Db = prisma): Promise<string> {
  return (await getTeamScope(userId, db)).billingAccountId;
}

/** Everyone whose work counts against this billing account: the partner and the members, or just the account. */
export async function accountMemberIds(
  billingAccountId: string,
  db: Db = prisma,
): Promise<string[]> {
  const org = await db.organisation.findUnique({
    where: { ownerId: billingAccountId },
    select: { members: { select: { id: true } } },
  });
  return org ? org.members.map((m) => m.id) : [billingAccountId];
}
