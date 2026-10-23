import { prisma } from '@/lib/db';
import { NotificationType } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';

type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
};

// Fire-and-forget from the caller's point of view: a notification failing
// to send must never fail the mutation that triggered it (e.g. posting an
// announcement should still succeed even if this write has a problem), so
// every export here swallows its own errors and logs instead of throwing.

export async function notifyUser(recipientId: string, input: CreateNotificationInput) {
  try {
    await prisma.notification.create({ data: { recipientId, ...input } });
  } catch (err) {
    console.error('notifyUser failed', err);
  }
}

export async function notifyUsers(recipientIds: string[], input: CreateNotificationInput) {
  if (recipientIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({ recipientId, ...input })),
    });
  } catch (err) {
    console.error('notifyUsers failed', err);
  }
}

// Best-effort email leg for the PRD's "automated notifications (email,
// in-app, push)" — reuses the existing console-transport sender as-is.
export async function notifyByEmail(to: string, subject: string, body: string) {
  try {
    await sendEmail({ to, subject, body });
  } catch (err) {
    console.error('notifyByEmail failed', err);
  }
}

/** The incoming request, passed through so email links use the right host in dev and tests. */
export type NotifyRequest = Parameters<typeof appUrl>[1];

type PersonInput = Omit<CreateNotificationInput, 'type'> & { type?: NotificationType };
type PersonOptions = {
  /** Also email the person. On by default: use `false` for chatty, low-stakes events. */
  email?: boolean;
  /** Email subject when it should differ from the notification title. */
  subject?: string;
  /** The incoming request, so links in the email match the host in dev and tests. */
  req?: NotifyRequest;
};

/**
 * The in-app notification and, unless `email: false`, an email to the same
 * person with a link straight to the screen that needs them. Like every
 * export here it never throws.
 */
export async function notifyAndEmail(
  recipientId: string,
  input: PersonInput,
  opts: PersonOptions = {},
) {
  try {
    await prisma.notification.create({
      data: { recipientId, type: input.type ?? 'SYSTEM', ...input },
    });
    if (opts.email === false) return;
    const person = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true, name: true },
    });
    if (!person?.email) return;
    const open = input.link ? `\n\nOpen it here: ${appUrl(input.link, opts.req)}` : '';
    await sendEmail({
      to: person.email,
      subject: opts.subject ?? input.title,
      body: `Hi ${person.name},\n\n${input.body}${open}`,
    });
  } catch (err) {
    console.error('notifyAndEmail failed', err);
  }
}

/** Tell the manager and the landlord of a property (once each), skipping whoever did the action. */
export async function notifyPropertyTeam(
  property: { managerId?: string | null; landlordId?: string | null },
  input: PersonInput,
  opts: PersonOptions & { exceptId?: string } = {},
) {
  const ids = [property.managerId, property.landlordId].filter(
    (id): id is string => !!id && id !== opts.exceptId,
  );
  for (const id of new Set(ids)) await notifyAndEmail(id, input, opts);
}

/** Tell every admin. In-app only by default: the callers that email admins keep doing that themselves. */
export async function notifyAdmins(input: PersonInput, opts: PersonOptions = { email: false }) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    for (const admin of admins) await notifyAndEmail(admin.id, input, opts);
  } catch (err) {
    console.error('notifyAdmins failed', err);
  }
}

/** Tell whoever holds the active rent on a unit, in the app and by email. */
export async function tellUnitTenant(
  unitId: string,
  input: Omit<PersonInput, 'link'> & { link?: string },
  opts: PersonOptions = {},
) {
  try {
    const rent = await prisma.rent.findFirst({
      where: { unitId, status: 'ACTIVE' },
      select: { tenantId: true },
    });
    if (rent) await notifyAndEmail(rent.tenantId, { link: '/dashboard', ...input }, opts);
  } catch (err) {
    console.error('tellUnitTenant failed', err);
  }
}
