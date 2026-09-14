import { prisma } from '@/lib/db';
import { NotificationType } from '@prisma/client';
import { sendEmail } from '@/lib/email';

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
