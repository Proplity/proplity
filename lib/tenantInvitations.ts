import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Prisma, Role } from '@prisma/client';
import { appUrl } from '@/lib/appUrl';
import type { InvitationState } from '@/lib/api/types';

// Inviting a new tenant by email: the account is made waiting (no way in yet), and an invitation
// carries a link that lets the person set their own password. Making the account and sending the
// invitation are separate steps so a file of tenants can be imported at once and invited as the
// daily limit allows (ISS-154).

type Tx = Prisma.TransactionClient;

export const INVITATION_DAYS = 7;

export class InviteLimitError extends Error {
  constructor(readonly limit: number) {
    super('Daily invitation limit reached');
  }
}

export function inviteLimitMessage(limit: number) {
  return `You have reached today's limit of ${limit} new people invited by email. Try again tomorrow, or ask an admin to raise the limit.`;
}

type PropertyForInvite = {
  moderationStatus: string;
  mergedIntoId: string | null;
  managementOnly: boolean;
};

/**
 * Whether this person may invite someone who has no account yet on this property. Emailing a
 * stranger in Proplity's name needs a listing an admin has approved, except on a property kept
 * for management only, which no admin reviews: there an admin switch decides. Admins may always.
 */
export function mayInviteNewTenant(
  actor: { role: string },
  property: PropertyForInvite,
  settings: { inviteTenantsToManagementOnly: boolean },
):
  | { allowed: true }
  | { allowed: false; code: 'LISTING_NOT_APPROVED' | 'INVITES_NOT_ALLOWED'; error: string } {
  if (actor.role === 'ADMIN') return { allowed: true };
  if (property.managementOnly) {
    return settings.inviteTenantsToManagementOnly
      ? { allowed: true }
      : {
          allowed: false,
          code: 'INVITES_NOT_ALLOWED',
          error:
            'Inviting new tenants by email is switched off for properties kept for management only',
        };
  }
  if (property.moderationStatus === 'APPROVED' && !property.mergedIntoId) return { allowed: true };
  return {
    allowed: false,
    code: 'LISTING_NOT_APPROVED',
    error: 'You can invite a new tenant by email once an admin has approved this listing',
  };
}

/** The row for a tenant account nobody can sign in to yet: waiting for an invitation. */
export async function waitingTenantData(data: {
  email: string;
  name: string;
  phoneNumber?: string | null;
}) {
  // The password is 192 random bits nobody sees; the cheap cost only avoids a quarter second per
  // person when a whole file is imported. The person sets their own password from the invitation.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4);
  return {
    email: data.email,
    name: data.name,
    phoneNumber: data.phoneNumber ?? undefined,
    passwordHash,
    role: 'TENANT' as const,
    status: 'PENDING_VERIFICATION' as const,
  };
}

export async function createWaitingTenant(
  tx: Tx,
  data: { email: string; name: string; phoneNumber?: string | null },
) {
  return tx.user.create({ data: await waitingTenantData(data) });
}

/**
 * Counts one invitation against the sender's day and makes the link. One sender's invitations queue
 * on a lock, so a burst cannot all pass the count. Admins are not limited. Sending again replaces
 * the old link. The caller emails the returned token after the transaction commits.
 */
export async function issueInvitation(
  tx: Tx,
  opts: {
    actor: { id: string; role: Role | string };
    tenant: { id: string; email: string };
    unitId: string;
    dailyLimit: number;
  },
): Promise<{ rawToken: string }> {
  const { actor, tenant, unitId, dailyLimit } = opts;
  if (actor.role !== 'ADMIN') {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tenant-invite:${actor.id}`}))`;
    const sent = await tx.auditLog.count({
      where: {
        actorId: actor.id,
        action: 'TENANT_INVITED',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (sent >= dailyLimit) throw new InviteLimitError(dailyLimit);
  }
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await tx.verificationToken.deleteMany({ where: { userId: tenant.id } });
  await tx.verificationToken.create({
    data: {
      userId: tenant.id,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'TENANT_INVITED',
      entityType: 'User',
      entityId: tenant.id,
      metadata: { email: tenant.email, unitId },
    },
  });
  return { rawToken };
}

export function invitationEmail(
  tenant: { name: string; email: string },
  rawToken: string,
  req?: Parameters<typeof appUrl>[1],
) {
  return {
    to: tenant.email,
    subject: 'You have been added as a tenant on Proplity',
    body: `Hi ${tenant.name},\n\nYou've been added as a tenant on Proplity. Set your password and activate your account:\n\n${appUrl(`/verify-email?token=${rawToken}`, req)}\n\nThis link expires in ${INVITATION_DAYS} days. After you sign in, please complete your profile.`,
  };
}

/**
 * Where a tenant is in joining: JOINED (has an active account), INVITED (link sent, not used yet),
 * EXPIRED (link ran out) or NOT_SENT (the account was made from a file and no invitation went out).
 */
export function invitationState(
  tenant: { status: string; verificationToken?: { expiresAt: Date } | null },
  now = new Date(),
): InvitationState {
  if (tenant.status !== 'PENDING_VERIFICATION') return 'JOINED';
  if (!tenant.verificationToken) return 'NOT_SENT';
  return tenant.verificationToken.expiresAt < now ? 'EXPIRED' : 'INVITED';
}
