import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';

// Who may start a free-form (DIRECT / SUPPORT) conversation with whom. Property staff
// and admins are reachable by any signed-in user (a tenant contacts a manager about a
// listing). Tenants and vendors are reachable only by someone who shares a property
// with them, so a user cannot open threads with strangers (ISS-074).

export const MAX_FREEFORM_PARTICIPANTS = 10;

async function propertyIdsFor(userId: string): Promise<Set<string>> {
  const [owned, rents, jobs] = await Promise.all([
    prisma.property.findMany({
      where: { OR: [{ managerId: userId }, { landlordId: userId }] },
      select: { id: true },
    }),
    prisma.rent.findMany({
      where: { tenantId: userId },
      select: { unit: { select: { propertyId: true } } },
    }),
    prisma.maintenanceRequest.findMany({
      where: { vendorId: userId },
      select: { unit: { select: { propertyId: true } } },
    }),
  ]);
  return new Set([
    ...owned.map((p) => p.id),
    ...rents.map((l) => l.unit.propertyId),
    ...jobs.map((j) => j.unit.propertyId),
  ]);
}

/** Returns an error message when the actor may not start a thread with these users, else null. */
export async function checkFreeformParticipants(
  actor: { sub: string; role: Role },
  targetIds: string[],
): Promise<string | null> {
  const others = [...new Set(targetIds)].filter((id) => id !== actor.sub);
  if (others.length + 1 > MAX_FREEFORM_PARTICIPANTS) {
    return `A conversation can have at most ${MAX_FREEFORM_PARTICIPANTS} people`;
  }
  const users = await prisma.user.findMany({
    where: { id: { in: others } },
    select: { id: true, role: true, status: true },
  });
  if (users.length !== others.length || users.some((u) => u.status !== 'ACTIVE')) {
    return 'One or more people could not be found';
  }
  if (actor.role === 'ADMIN') return null;
  const restricted = users.filter((u) => u.role === 'TENANT' || u.role === 'VENDOR');
  if (restricted.length === 0) return null;
  const mine = await propertyIdsFor(actor.sub);
  for (const u of restricted) {
    const theirs = await propertyIdsFor(u.id);
    if (![...theirs].some((id) => mine.has(id))) {
      return 'You can only message tenants and vendors you share a property with';
    }
  }
  return null;
}
