-- A repair no longer needs a tenant: the property team can raise a work order itself (a vacant or
-- unleased unit, or something it found). Who raised it is recorded in createdById.
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The day of the month a schedule is meant to fall on, so a monthly schedule that starts on the 31st
-- comes back to the 31st after a short month instead of drifting to the 28th for good.
ALTER TABLE "MaintenanceSchedule" ADD COLUMN     "dayOfMonth" INTEGER;

-- Existing monthly and longer schedules take the day of their next due date.
UPDATE "MaintenanceSchedule"
SET "dayOfMonth" = EXTRACT(DAY FROM "nextDueDate")::int
WHERE "frequency" <> 'WEEKLY';
