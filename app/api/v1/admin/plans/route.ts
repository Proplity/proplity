import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { ensureDefaultPlans, listPlans } from '@/lib/plans';
import { createPlanSchema } from '@/lib/planSchema';

export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await listPlans() });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createPlanSchema);
      if (!validated.success) return validated.response;
      const data = validated.data;
      if (data.isDefault && data.monthlyPrice !== 0) {
        return NextResponse.json(
          {
            error: 'The default plan is what everyone gets without paying, so its price must be 0',
          },
          { status: 400 },
        );
      }
      if (data.isDefault && data.isActive === false) {
        return NextResponse.json({ error: 'The default plan has to stay active' }, { status: 400 });
      }

      // Seed the first set before adding, so a new plan never lands alone in an empty table.
      await ensureDefaultPlans();
      const plan = await prisma.$transaction(async (tx) => {
        if (data.isDefault) await tx.plan.updateMany({ data: { isDefault: false } });
        return tx.plan.create({ data });
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'PLAN_CREATED',
          entityType: 'Plan',
          entityId: plan.id,
          metadata: { key: plan.key, name: plan.name } as object,
        },
      });
      return NextResponse.json({ data: plan }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
