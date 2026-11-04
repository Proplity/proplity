import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { updatePlanSchema } from '@/lib/planSchema';

type RouteCtx = { params: Promise<{ id: string }> };

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, updatePlanSchema);
      if (!validated.success) return validated.response;
      const data = validated.data;

      const current = await prisma.plan.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

      const next = {
        ...current,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      };
      if (next.isDefault && next.monthlyPrice !== 0) {
        return NextResponse.json(
          {
            error: 'The default plan is what everyone gets without paying, so its price must be 0',
          },
          { status: 400 },
        );
      }
      if (next.isDefault && !next.isActive) {
        return NextResponse.json({ error: 'The default plan has to stay active' }, { status: 400 });
      }
      if (current.isDefault && data.isDefault === false) {
        return NextResponse.json(
          { error: 'Make another plan the default instead; there must always be one' },
          { status: 400 },
        );
      }

      const plan = await prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.plan.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
        }
        return tx.plan.update({ where: { id }, data });
      });

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, to] of Object.entries(data)) {
        const from = current[k as keyof typeof current];
        if (to !== undefined && JSON.stringify(from) !== JSON.stringify(to))
          changes[k] = { from, to };
      }
      if (Object.keys(changes).length > 0) {
        await prisma.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'PLAN_UPDATED',
            entityType: 'Plan',
            entityId: id,
            metadata: { key: plan.key, changes } as object,
          },
        });
      }
      return NextResponse.json({ data: plan });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const plan = await prisma.plan.findUnique({
        where: { id },
        include: { _count: { select: { subscriptions: true } } },
      });
      if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      if (plan.isDefault) {
        return NextResponse.json(
          { error: 'The default plan cannot be deleted; make another plan the default first' },
          { status: 409 },
        );
      }
      if (plan._count.subscriptions > 0) {
        return NextResponse.json(
          {
            error: `${plan._count.subscriptions} account(s) are on this plan. Switch it off instead; they keep it and nobody new can choose it.`,
            code: 'PLAN_IN_USE',
          },
          { status: 409 },
        );
      }
      await prisma.plan.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'PLAN_DELETED',
          entityType: 'Plan',
          entityId: id,
          metadata: { key: plan.key, name: plan.name } as object,
        },
      });
      return NextResponse.json({ data: { id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
