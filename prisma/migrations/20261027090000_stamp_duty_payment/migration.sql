-- CreateEnum
CREATE TYPE "StampDutyBasis" AS ENUM ('ANNUAL_RENT', 'TERM_RENT');

-- CreateEnum
CREATE TYPE "StampDutyOrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'STAMP_DUTY';

-- AlterTable
ALTER TABLE "Jurisdiction" ADD COLUMN     "stampDutyBasis" "StampDutyBasis" NOT NULL DEFAULT 'TERM_RENT',
ADD COLUMN     "stampDutyTiers" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "stampDutyPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stampDutyServiceFee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StampDutyOrder" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "StampDutyOrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "jurisdictionName" TEXT NOT NULL,
    "termYears" DOUBLE PRECISION NOT NULL,
    "basis" "StampDutyBasis" NOT NULL,
    "basisAmount" DOUBLE PRECISION NOT NULL,
    "ratePercent" DOUBLE PRECISION NOT NULL,
    "dutyAmount" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "actualAmount" DOUBLE PRECISION,
    "reference" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StampDutyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StampDutyOrder_invoiceId_key" ON "StampDutyOrder"("invoiceId");

-- CreateIndex
CREATE INDEX "StampDutyOrder_status_createdAt_idx" ON "StampDutyOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StampDutyOrder_agreementId_idx" ON "StampDutyOrder"("agreementId");

-- AddForeignKey
ALTER TABLE "StampDutyOrder" ADD CONSTRAINT "StampDutyOrder_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RentAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampDutyOrder" ADD CONSTRAINT "StampDutyOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
