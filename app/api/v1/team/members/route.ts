import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { emailSchema, findUserByEmail } from '@/lib/auth/email';
import { sendEmail } from '@/lib/email';
import { appUrl } from '@/lib/appUrl';
import { getSystemSettings } from '@/lib/systemSettings';
import { getAccountPlan } from '@/lib/plans';

const inviteSchema = z.object({
  name: z.string().trim().min(1, 'Enter their name').max(120),
  email: emailSchema,
  phoneNumber: z.string().trim().max(40).optional(),
});

class SeatLimitError extends Error {
  constructor(
    public used: number,
    public included: number,
    public planName: string,
  ) {
    super(
      `Your ${planName} plan includes ${included} user${included === 1 ? '' : 's'} and ${used} are in use. Move to a bigger plan to add more people.`,
    );
  }
}

// The managing partner adds someone from the firm. They get their own manager account and an email
// to set a password; nothing is shared with them until the partner gives them properties. People
// who already have a Proplity account cannot be added this way: it would hand the partner their
// properties without their say.
export const POST = withAuth(
  async (req, { session }) => {
    try {
      if (!session.org?.isOwner) {
        return NextResponse.json(
          { error: 'Only the managing partner can add people to the company' },
          { status: 403 },
        );
      }
      const validated = await validateBody(req, inviteSchema);
      if (!validated.success) return validated.response;
      const { name, email, phoneNumber } = validated.data;
      const orgId = session.org.id;

      if (await findUserByEmail(email)) {
        return NextResponse.json(
          {
            error:
              'That email address already has a Proplity account, so they cannot be added here',
            code: 'EMAIL_IN_USE',
          },
          { status: 409 },
        );
      }

      const settings = await getSystemSettings();
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const member = await prisma.$transaction(async (tx) => {
        // Two invitations at once queue on a lock, so a burst cannot pass the seat limit.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-seats:${orgId}`}))`;
        if (settings.enforcePlanLimits) {
          const { plan } = await getAccountPlan(session.sub, tx);
          const used = await tx.user.count({ where: { organisationId: orgId } });
          if (used >= plan.usersIncluded)
            throw new SeatLimitError(used, plan.usersIncluded, plan.name);
        }
        const created = await tx.user.create({
          data: {
            email,
            name,
            phoneNumber,
            passwordHash,
            role: 'MANAGER',
            status: 'PENDING_VERIFICATION',
            organisationId: orgId,
          },
        });
        await tx.verificationToken.create({
          data: {
            userId: created.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'TEAM_MEMBER_ADDED',
            entityType: 'User',
            entityId: created.id,
            metadata: { email: created.email, organisationId: orgId } as object,
          },
        });
        return created;
      });

      await sendEmail({
        to: member.email,
        subject: 'You have been added to a team on Proplity',
        body: `Hi ${member.name},\n\nYou've been added to a property management team on Proplity. Set your password and activate your account:\n\n${appUrl(`/verify-email?token=${rawToken}`, req)}\n\nThis link expires in 7 days.`,
      });

      return NextResponse.json(
        { data: { id: member.id, name: member.name, email: member.email } },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof SeatLimitError) {
        return NextResponse.json(
          {
            error: err.message,
            code: 'PLAN_LIMIT',
            used: err.used,
            limit: err.included,
            plan: err.planName,
          },
          { status: 403 },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);
