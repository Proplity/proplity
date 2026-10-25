-- CreateEnum
CREATE TYPE "AgreementSource" AS ENUM ('GENERATED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ISSUED', 'EXECUTED', 'VOID');

-- CreateEnum
CREATE TYPE "StampDutyStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'STAMPED');

-- CreateTable
CREATE TABLE "RentAgreement" (
    "id" TEXT NOT NULL,
    "rentId" TEXT NOT NULL,
    "source" "AgreementSource" NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "templateKey" TEXT,
    "templateVersion" INTEGER,
    "jurisdictionId" TEXT,
    "choices" JSONB,
    "clauses" JSONB,
    "specialConditions" TEXT,
    "landlordName" TEXT,
    "agentName" TEXT,
    "agencyFee" DOUBLE PRECISION,
    "legalFee" DOUBLE PRECISION,
    "witnesses" JSONB,
    "witnessRequired" BOOLEAN NOT NULL DEFAULT true,
    "fileUrl" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedName" TEXT,
    "confirmedIp" TEXT,
    "stampDutyStatus" "StampDutyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "stampDutyReference" TEXT,
    "stampDutyAmount" DOUBLE PRECISION,
    "stampDutyReceiptUrl" TEXT,
    "stampedAt" TIMESTAMP(3),
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "creditEntryId" TEXT,
    "createdById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentAgreement_rentId_status_idx" ON "RentAgreement"("rentId", "status");

-- AddForeignKey
ALTER TABLE "RentAgreement" ADD CONSTRAINT "RentAgreement_rentId_fkey" FOREIGN KEY ("rentId") REFERENCES "Rent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAgreement" ADD CONSTRAINT "RentAgreement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgreementTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAgreement" ADD CONSTRAINT "RentAgreement_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentAgreement" ADD CONSTRAINT "RentAgreement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
