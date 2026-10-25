-- AlterTable
ALTER TABLE "Rent" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRenewIncreasePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "autoRenewTermMonths" INTEGER;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "agreementRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agreementRenewalEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agreementUnsignedReminderDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "autoRenewalDaysBefore" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "autoRenewalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "renewalReminderDays" INTEGER[] DEFAULT ARRAY[90, 60, 30]::INTEGER[];

-- CreateTable
CREATE TABLE "RentReminderLog" (
    "id" TEXT NOT NULL,
    "rentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentReminderLog_rentId_kind_key_key" ON "RentReminderLog"("rentId", "kind", "key");

-- AddForeignKey
ALTER TABLE "RentReminderLog" ADD CONSTRAINT "RentReminderLog_rentId_fkey" FOREIGN KEY ("rentId") REFERENCES "Rent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
