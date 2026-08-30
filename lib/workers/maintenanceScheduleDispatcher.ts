import { prisma } from '@/lib/db';
import { ScheduleFrequency } from '@prisma/client';

function addInterval(date: Date, frequency: ScheduleFrequency): Date {
  const next = new Date(date);
  const monthsToAdd = { WEEKLY: 0, MONTHLY: 1, QUARTERLY: 3, SEMI_ANNUAL: 6, ANNUAL: 12 }[
    frequency
  ];
  if (frequency === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + monthsToAdd);
  }
  return next;
}

export async function runMaintenanceScheduleDispatcher(): Promise<{
  dispatched: number;
  skippedNoTenant: number;
}> {
  const now = new Date();
  const due = await prisma.maintenanceSchedule.findMany({
    where: { isActive: true, nextDueDate: { lte: now } },
    include: { category: true },
  });

  let dispatched = 0;
  let skippedNoTenant = 0;

  for (const schedule of due) {
    // MaintenanceRequest.tenantId is required, but a schedule-generated
    // request is staff-initiated preventive maintenance with no natural
    // reporter. Attribute it to whoever currently lives there -- correct
    // even though they didn't report it, since it's their unit being
    // serviced. No active tenant -> skip rather than inventing one; the
    // schema has no "no tenant" shape for a request.
    const activeLease = await prisma.lease.findFirst({
      where: { unitId: schedule.unitId, status: 'ACTIVE' },
    });

    if (!activeLease) {
      skippedNoTenant += 1;
      // Still advance the schedule -- an unoccupied unit shouldn't cause
      // this schedule to fire every single run once it starts being overdue.
      await prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          nextDueDate: addInterval(schedule.nextDueDate, schedule.frequency),
          lastGeneratedAt: now,
        },
      });
      continue;
    }

    await prisma.$transaction([
      prisma.maintenanceRequest.create({
        data: {
          unitId: schedule.unitId,
          tenantId: activeLease.tenantId,
          categoryId: schedule.categoryId,
          title: `Scheduled maintenance: ${schedule.category.name}`,
          description: `Routine ${schedule.frequency.toLowerCase()} maintenance for ${schedule.category.name}, auto-generated from the property's maintenance schedule.`,
          priority: 'MEDIUM',
        },
      }),
      prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          nextDueDate: addInterval(schedule.nextDueDate, schedule.frequency),
          lastGeneratedAt: now,
        },
      }),
    ]);
    dispatched += 1;
  }

  return { dispatched, skippedNoTenant };
}
