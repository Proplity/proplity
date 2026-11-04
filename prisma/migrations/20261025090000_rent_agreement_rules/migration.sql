-- CreateEnum
CREATE TYPE "RuleMode" AS ENUM ('OFF', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RentActivationRule" AS ENUM ('INDEPENDENT', 'AFTER_BOTH_SIGN');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "agreementAgencyFee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agreementCautionFee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agreementLandlordNameByManager" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agreementLegalFee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agreementTemplatesNeedApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chargeForAgreements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chargeForUploads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentActivationRule" "RentActivationRule" NOT NULL DEFAULT 'INDEPENDENT';

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "states" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "advanceRentMaxMonths" INTEGER,
    "advanceRentMode" "RuleMode" NOT NULL DEFAULT 'WARN',
    "noticeDays" JSONB NOT NULL DEFAULT '{}',
    "excludedAreas" TEXT[],
    "excludedAreasMode" "RuleMode" NOT NULL DEFAULT 'WARN',
    "registrationThresholdYears" INTEGER,
    "stampDutyNote" TEXT,
    "sourceNote" TEXT,
    "rulesCheckedAt" TIMESTAMP(3),
    "lawyerReviewed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "jurisdictionId" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "clauses" JSONB NOT NULL,
    "witnessRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_key_key" ON "Jurisdiction"("key");

-- CreateIndex
CREATE INDEX "AgreementTemplate_jurisdictionId_status_idx" ON "AgreementTemplate"("jurisdictionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_key_version_key" ON "AgreementTemplate"("key", "version");

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
