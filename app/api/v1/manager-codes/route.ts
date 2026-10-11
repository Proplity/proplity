import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { appUrl } from '@/lib/appUrl';
import { sendEmail } from '@/lib/email';
import { emailSchema } from '@/lib/auth/email';
import { reserveAttempt } from '@/lib/auth/rateLimit';

export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const codes = await prisma.managerInviteCode.findMany({
        where: { landlordId: session.sub },
        include: { linkedManager: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ data: codes });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['LANDLORD'] },
);

// Same LLD-XXXX-XX shape LandlordDashboard.tsx's local generateCode() already
// used before this route existed -- kept identical so the UI's display
// format doesn't need to change, only where the code comes from.
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LLD-${part(4)}-${part(2)}`;
}

export const POST = withAuth(
  async (req: NextRequest, { session }) => {
    try {
      let inviteEmail: string | undefined;
      let body: unknown = null;
      try {
        body = await req.json();
      } catch {
        // Body is optional
      }
      const rawEmail = (body as { email?: unknown } | null)?.email;
      if (rawEmail !== undefined && rawEmail !== null && rawEmail !== '') {
        const parsedEmail = emailSchema.safeParse(rawEmail);
        if (!parsedEmail.success) {
          return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }
        inviteEmail = parsedEmail.data;
        // Each invite sends a real email, so bound how many one landlord can
        // trigger (otherwise this is an open mail relay to arbitrary addresses).
        const { allowed } = await reserveAttempt(`manager-invite:${session.sub}`, session.sub, 5);
        if (!allowed) {
          return NextResponse.json(
            { error: 'Too many invitations sent. Please try again in a few minutes.' },
            { status: 429 },
          );
        }
      }

      // Vanishingly unlikely to collide (code has no DB-level retry loop
      // elsewhere in the codebase either, e.g. AccessCode's own code field),
      // but code is @unique -- retry once on the rare conflict.
      let created;
      try {
        created = await prisma.managerInviteCode.create({
          data: { code: generateCode(), landlordId: session.sub },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          created = await prisma.managerInviteCode.create({
            data: { code: generateCode(), landlordId: session.sub },
          });
        } else {
          throw err;
        }
      }

      if (inviteEmail) {
        const landlord = await prisma.user.findUnique({
          where: { id: session.sub },
          select: { name: true },
        });
        const landlordName = landlord?.name || 'A landlord';

        try {
          await sendEmail({
            to: inviteEmail,
            subject: `${landlordName} invited you to manage properties on Proplity`,
            body: `Hi,\n\n${landlordName} has invited you to manage their property portfolio on Proplity.\n\nYour invitation code is: ${created.code}\n\nTo accept this invitation and create your Property Manager account, click the link below:\n\n${appUrl(`/register?role=manager&code=${created.code}`, req)}\n\nThis will automatically link your account to ${landlordName}'s properties once verified.`,
          });
        } catch (mailErr) {
          // Don't leave an orphan code behind for a landlord who will just retry.
          await prisma.managerInviteCode.delete({ where: { id: created.id } });
          console.error('Manager invite email failed', mailErr);
          return NextResponse.json(
            { error: 'Could not send the invitation email. Please try again.' },
            { status: 502 },
          );
        }
      }

      return NextResponse.json({ data: created, invitedEmail: inviteEmail }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['LANDLORD'] },
);
