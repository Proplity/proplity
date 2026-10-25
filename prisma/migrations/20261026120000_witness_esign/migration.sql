-- CreateEnum
CREATE TYPE "WitnessSide" AS ENUM ('LANDLORD', 'TENANT');

-- CreateEnum
CREATE TYPE "WitnessStatus" AS ENUM ('INVITED', 'SIGNED');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "witnessEsignEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "witnessLinkDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "witnessesMustSign" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AgreementWitness" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "side" "WitnessSide" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "WitnessStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" TEXT,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "signedName" TEXT,
    "signedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementWitness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgreementWitness_tokenHash_key" ON "AgreementWitness"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementWitness_agreementId_side_key" ON "AgreementWitness"("agreementId", "side");

-- AddForeignKey
ALTER TABLE "AgreementWitness" ADD CONSTRAINT "AgreementWitness_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RentAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
