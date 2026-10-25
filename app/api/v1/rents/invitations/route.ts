import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { propertyScopeWhere } from '@/lib/api/propertyAccess';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/systemSettings';
import {
  InviteLimitError,
  invitationEmail,
  invitationState,
  issueInvitation,
  mayInviteNewTenant,
} from '@/lib/tenantInvitations';

// Sends the invitation to every tenant of the caller's properties who is still waiting for one
// (none sent yet, or the link ran out), as many as today's limit allows. A file import creates
// tenants without emailing them; this is how the emails go out, a day's worth at a time.
export const POST = withAuth(
  async (req, { session }) => {
    try {
      const settings = await getSystemSettings();
      const rents = await prisma.rent.findMany({
        where: {
          status: { in: ['PENDING', 'ACTIVE'] },
          tenant: { status: 'PENDING_VERIFICATION' },
          unit: { property: propertyScopeWhere(session.scope) },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          unit: { include: { property: true } },
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              verificationToken: { select: { expiresAt: true } },
            },
          },
        },
      });

      // One invitation per person, even when they have several rents.
      const waiting = new Map<string, (typeof rents)[number]>();
      let notAllowed = 0;
      for (const rent of rents) {
        const state = invitationState(rent.tenant);
        if (state !== 'NOT_SENT' && state !== 'EXPIRED') continue;
        if (waiting.has(rent.tenant.id)) continue;
        if (!mayInviteNewTenant(session, rent.unit.property, settings).allowed) {
          notAllowed += 1;
          continue;
        }
        waiting.set(rent.tenant.id, rent);
      }

      let sent = 0;
      let limitReached = false;
      for (const rent of waiting.values()) {
        try {
          const { rawToken } = await prisma.$transaction((tx) =>
            issueInvitation(tx, {
              actor: { id: session.sub, role: session.role },
              tenant: rent.tenant,
              unitId: rent.unitId,
              dailyLimit: settings.tenantInvitesPerDay,
            }),
          );
          await sendEmail(invitationEmail(rent.tenant, rawToken, req));
          sent += 1;
        } catch (err) {
          if (err instanceof InviteLimitError) {
            limitReached = true;
            break;
          }
          throw err;
        }
      }

      return NextResponse.json({
        data: {
          sent,
          stillWaiting: waiting.size - sent,
          notAllowed,
          limitReached,
          dailyLimit: settings.tenantInvitesPerDay,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
