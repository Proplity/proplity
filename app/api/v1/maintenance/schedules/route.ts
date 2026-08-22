import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, ScheduleFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

export const GET = withAuth(
  async (req, { session }) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);

      const where: Prisma.MaintenanceScheduleWhereInput =
        session.role === 'ADMIN'
          ? {}
          : { unit: { property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] } } };

      const [schedules, total] = await Promise.all([
        prisma.maintenanceSchedule.findMany({
          where,
          skip,
          take,
          include: { unit: true, category: true, equipment: true },
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

      const schedule = await prisma.maintenanceSchedule.create({ data: validated.data });
      return NextResponse.json({ data: schedule }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
