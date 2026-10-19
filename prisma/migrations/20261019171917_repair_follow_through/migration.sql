-- CreateEnum
CREATE TYPE "RepairConfirmationStatus" AS ENUM ('NOT_REQUESTED', 'AWAITING_TENANT', 'CONFIRMED', 'DISPUTED');

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "afterPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "beforePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "confirmationRespondedAt" TIMESTAMP(3),
ADD COLUMN     "confirmationStatus" "RepairConfirmationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "disputePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "disputeReason" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "requireTenantRepairConfirmation" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "MaintenanceRequest_confirmationStatus_idx" ON "MaintenanceRequest"("confirmationStatus");

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
