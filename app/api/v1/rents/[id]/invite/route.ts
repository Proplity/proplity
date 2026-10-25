import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  InviteLimitError,
  inviteLimitMessage,
  invitationEmail,
  issueInvitation,
  mayInviteNewTenant,
} from '@/lib/tenantInvitations';

type RouteCtx = { params: Promise<{ id: string }> };

// Sends (or sends again) the invitation to a tenant who has not signed in yet: the email with the
// link that lets them set a password. It counts against the sender's daily limit, like any other
// invitation, and replaces the old link.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const rent = await prisma.rent.findUnique({
        where: { id },
        include: {
          unit: { include: { property: true } },
          tenant: {
            select: { id: true, name: true, email: true, status: true },
          },
        },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (rent.tenant.status !== 'PENDING_VERIFICATION') {
        return NextResponse.json(
          {
            error: 'This tenant has already joined, so there is nothing to send',
            code: 'ALREADY_JOINED',
          },
          { status: 409 },
        );
      }

      const settings = await getSystemSettings();
      const mayInvite = mayInviteNewTenant(session, rent.unit.property, settings);
      if (!mayInvite.allowed) {
        return NextResponse.json({ error: mayInvite.error, code: mayInvite.code }, { status: 403 });
      }

      const { rawToken } = await prisma.$transaction((tx) =>
        issueInvitation(tx, {
          actor: { id: session.sub, role: session.role },
          tenant: rent.tenant,
          unitId: rent.unitId,
          dailyLimit: settings.tenantInvitesPerDay,
        }),
      );
      await sendEmail(invitationEmail(rent.tenant, rawToken, req));

      return NextResponse.json({ data: { invitation: 'INVITED' } });
    } catch (err) {
      if (err instanceof InviteLimitError) {
        return NextResponse.json(
          { error: inviteLimitMessage(err.limit), code: 'INVITE_LIMIT' },
          { status: 429 },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
