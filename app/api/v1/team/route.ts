import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { getSystemSettings } from '@/lib/systemSettings';
import { getAccountPlan } from '@/lib/plans';

// A company is a managing partner and the people in the firm who manage properties, each with
// their own login. The partner's plan covers all of them (lib/team.ts).

export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const settings = await getSystemSettings();
      const { plan } = await getAccountPlan(session.sub);
      if (!session.org) {
        return NextResponse.json({
          data: {
            organisation: null,
            isPartner: false,
            members: [],
            seats: { used: 1, included: plan.usersIncluded },
            limitsEnforced: settings.enforcePlanLimits,
          },
        });
      }
      const org = await prisma.organisation.findUniqueOrThrow({
        where: { id: session.org.id },
        select: {
          id: true,
          name: true,
          ownerId: true,
          members: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              _count: { select: { managedProperties: true } },
            },
          },
        },
      });
      return NextResponse.json({
        data: {
          organisation: { id: org.id, name: org.name },
          isPartner: org.ownerId === session.sub,
          members: org.members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            status: m.status,
            isPartner: m.id === org.ownerId,
            properties: m._count.managedProperties,
          })),
          seats: { used: org.members.length, included: plan.usersIncluded },
          limitsEnforced: settings.enforcePlanLimits,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);

const nameSchema = z.object({ name: z.string().trim().min(1, 'Give the company a name').max(80) });

// Starting a company makes the person its managing partner. They keep their account, their
// properties and their plan; they can then add the people in the firm.
export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, nameSchema);
      if (!validated.success) return validated.response;
      if (session.org) {
        return NextResponse.json(
          { error: 'You already work in a company', code: 'ALREADY_IN_COMPANY' },
          { status: 409 },
        );
      }
      const org = await prisma.$transaction(async (tx) => {
        const created = await tx.organisation.create({
          data: { name: validated.data.name, ownerId: session.sub },
        });
        await tx.user.update({ where: { id: session.sub }, data: { organisationId: created.id } });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'COMPANY_CREATED',
            entityType: 'Organisation',
            entityId: created.id,
            metadata: { name: created.name } as object,
          },
        });
        return created;
      });
      return NextResponse.json({ data: { id: org.id, name: org.name } }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);

export const PATCH = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, nameSchema);
      if (!validated.success) return validated.response;
      if (!session.org?.isOwner) {
        return NextResponse.json(
          { error: 'Only the managing partner can rename the company' },
          { status: 403 },
        );
      }
      const org = await prisma.organisation.update({
        where: { id: session.org.id },
        data: { name: validated.data.name },
      });
      return NextResponse.json({ data: { id: org.id, name: org.name } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER'] },
);
