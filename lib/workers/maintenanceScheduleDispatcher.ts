import { prisma } from '@/lib/db';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';
import { nextDueDate } from '@/lib/maintenanceSchedule';

export async function runMaintenanceScheduleDispatcher(): Promise<{
  dispatched: number;
  forVacantUnits: number;
}> {
  const now = new Date();
  const due = await prisma.maintenanceSchedule.findMany({
    where: { isActive: true, nextDueDate: { lte: now } },
    include: { category: true, unit: { include: { property: true } } },
  });

  let dispatched = 0;
  let forVacantUnits = 0;

  for (const schedule of due) {
    // A schedule-generated request is staff-initiated preventive maintenance with no natural
    // reporter. On an occupied unit it is attributed to whoever lives there (it is their unit being
    // serviced, so they are told and can say whether it is fixed). On a vacant or unleased unit
    // there is nobody to attribute it to: it becomes a work order with no tenant (it used to be
    // skipped silently, so a vacant unit's servicing never happened).
    const activeLease = await prisma.lease.findFirst({
      where: { unitId: schedule.unitId, status: 'ACTIVE' },
    });
    const tenantId = activeLease?.tenantId ?? null;

    const [request] = await prisma.$transaction([
      prisma.maintenanceRequest.create({
        data: {
          unitId: schedule.unitId,
          tenantId,
          categoryId: schedule.categoryId,
          title: `Scheduled maintenance: ${schedule.category.name}`,
          description: `Routine ${schedule.frequency.toLowerCase().replace('_', '-')} maintenance for ${schedule.category.name}, auto-generated from the property's maintenance schedule.`,
          priority: 'MEDIUM',
        },
      }),
      prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          nextDueDate: nextDueDate(schedule.nextDueDate, schedule.frequency, schedule.dayOfMonth),
          lastGeneratedAt: now,
        },
      }),
    ]);
    dispatched += 1;
    if (!tenantId) forVacantUnits += 1;

    // The request exists with no vendor yet: the property team assigns one, the tenant (if any) is
    // told someone will be in their unit.
    await notifyPropertyTeam(
      schedule.unit.property,
      {
        type: 'MAINTENANCE_STATUS',
        title: `${request.title} needs a vendor`,
        body: `A ${schedule.frequency.toLowerCase().replace('_', '-')} schedule raised "${request.title}" for unit ${schedule.unit.unitNumber} at ${schedule.unit.property.name}${tenantId ? '' : ' (no tenant lives there)'}.`,
        link: `/dashboard/maintenance/${request.id}`,
      },
      { email: false },
    );
    if (tenantId) {
      await notifyAndEmail(
        tenantId,
        {
          type: 'MAINTENANCE_STATUS',
          title: 'Scheduled maintenance for your unit',
          body: `${request.title} is coming up for unit ${schedule.unit.unitNumber}. The property team will arrange a vendor.`,
          link: `/dashboard/maintenance/${request.id}`,
        },
        { email: false },
      );
    }
  }

  return { dispatched, forVacantUnits };
}
