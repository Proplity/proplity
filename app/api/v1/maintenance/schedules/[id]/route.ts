import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ScheduleFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { anchorDay } from '@/lib/maintenanceSchedule';

type RouteCtx = { params: Promise<{ id: string }> };

const INCLUDE = {
  unit: { include: { property: { select: { id: true, name: true } } } },
  category: true,
  equipment: true,
} as const;

function loadSchedule(id: string) {
  return prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
}

const patchSchema = z
  .object({
    categoryId: z.string(),
    frequency: z.nativeEnum(ScheduleFrequency),
    nextDueDate: z.coerce.date(),
    // null takes the schedule off a piece of equipment (it then covers the unit in general).
    equipmentId: z.string().nullable(),
    // Pause or resume. A paused schedule keeps its dates and raises nothing until resumed.
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' });

// Change a schedule, or pause and resume it. The property team and admins only.
export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    try {
      const { id } = await ctx.params;
      const schedule = await loadSchedule(id);
      if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      if (!canManageProperty(session, schedule.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const input = validated.data;

      if (input.categoryId) {
        const category = await prisma.maintenanceCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      if (input.equipmentId) {
        const equipment = await prisma.equipment.findFirst({
          where: {
            id: input.equipmentId,
            OR: [{ unitId: schedule.unitId }, { propertyId: schedule.unit.propertyId }],
          },
        });
        if (!equipment) {
          return NextResponse.json(
            { error: 'That equipment does not belong to this unit or its building' },
            { status: 400 },
          );
        }
      }

      // The intended day of the month follows the first date and cycle the person last chose.
      const frequency = input.frequency ?? schedule.frequency;
      const nextDueDate = input.nextDueDate ?? schedule.nextDueDate;
      const reanchor = input.frequency !== undefined || input.nextDueDate !== undefined;

      const updated = await prisma.maintenanceSchedule.update({
        where: { id },
        data: {
          ...input,
          ...(reanchor ? { dayOfMonth: anchorDay(nextDueDate, frequency) } : {}),
        },
        include: INCLUDE,
      });
      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);

// Remove a schedule. It is configuration only: nothing points at it (the repairs it already raised
// stay), so it is really deleted rather than archived. Pausing is the reversible option.
export const DELETE = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    try {
      const { id } = await ctx.params;
      const schedule = await loadSchedule(id);
      if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      if (!canManageProperty(session, schedule.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await prisma.$transaction([
        prisma.maintenanceSchedule.delete({ where: { id } }),
        prisma.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'MAINTENANCE_SCHEDULE_DELETED',
            entityType: 'MaintenanceSchedule',
            entityId: id,
            metadata: {
              unitId: schedule.unitId,
              categoryId: schedule.categoryId,
              frequency: schedule.frequency,
            },
          },
        }),
      ]);
      return NextResponse.json({ data: { id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
