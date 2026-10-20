import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, ScheduleFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { anchorDay } from '@/lib/maintenanceSchedule';

export const GET = withAuth(
  async (req, { session }) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);

      const where: Prisma.MaintenanceScheduleWhereInput =
        session.role === 'ADMIN'
          ? {}
          : {
              unit: { property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] } },
            };

      const [schedules, total] = await Promise.all([
        prisma.maintenanceSchedule.findMany({
          where,
          skip,
          take,
          include: {
            unit: { include: { property: { select: { id: true, name: true } } } },
            category: true,
            equipment: true,
          },
          orderBy: { nextDueDate: 'asc' },
        }),
        prisma.maintenanceSchedule.count({ where }),
      ]);

      return NextResponse.json({ data: schedules, meta: buildMeta(total, page, limit) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);

const createScheduleSchema = z.object({
  unitId: z.string(),
  categoryId: z.string(),
  frequency: z.nativeEnum(ScheduleFrequency),
  nextDueDate: z.coerce.date(),
  equipmentId: z.string().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createScheduleSchema);
      if (!validated.success) return validated.response;

      const unit = await prisma.unit.findUnique({
        where: { id: validated.data.unitId },
        include: { property: true },
      });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      if (!canManageProperty(session, unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { equipmentId, categoryId, frequency, nextDueDate } = validated.data;
      const category = await prisma.maintenanceCategory.findUnique({ where: { id: categoryId } });
      if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      if (equipmentId) {
        // The equipment has to be in this unit, or one of the building's shared items.
        const equipment = await prisma.equipment.findFirst({
          where: {
            id: equipmentId,
            OR: [{ unitId: unit.id }, { propertyId: unit.propertyId }],
          },
        });
        if (!equipment) {
          return NextResponse.json(
            { error: 'That equipment does not belong to this unit or its building' },
            { status: 400 },
          );
        }
      }

      const schedule = await prisma.maintenanceSchedule.create({
        data: { ...validated.data, dayOfMonth: anchorDay(nextDueDate, frequency) },
      });
      return NextResponse.json({ data: schedule }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
