-- Plans, credits and the paid-services catalogue, plus the admin settings that govern limits, and who
-- added a property. Subscription.tier (an enum) is replaced by a link to an editable Plan row; there is no
-- production data, so existing subscription rows simply fall back to the default plan.

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('MONTHLY_ALLOWANCE', 'ADMIN_GRANT', 'PURCHASE', 'SPEND', 'REFUND');

-- CreateEnum
CREATE TYPE "UnitBillingOwner" AS ENUM ('MANAGER_ELSE_LANDLORD', 'CREATOR', 'BOTH');

-- CreateEnum
CREATE TYPE "OverageMode" AS ENUM ('ALLOW_AND_BILL', 'HARD_STOP', 'CONFIRM_EACH_TIME');

-- CreateEnum
CREATE TYPE "DowngradeRule" AS ENUM ('BLOCK', 'GRACE_PERIOD', 'ALLOW_AND_BILL');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "tier",
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "planId" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "downgradeGraceDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "downgradeRule" "DowngradeRule" NOT NULL DEFAULT 'BLOCK',
ADD COLUMN     "enforcePlanLimits" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overageMode" "OverageMode" NOT NULL DEFAULT 'ALLOW_AND_BILL',
ADD COLUMN     "unitBillingOwner" "UnitBillingOwner" NOT NULL DEFAULT 'MANAGER_ELSE_LANDLORD';

-- DropEnum
DROP TYPE "PlanTier";

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "monthlyPrice" INTEGER NOT NULL DEFAULT 0,
    "yearlyPrice" INTEGER,
    "unitsIncluded" INTEGER NOT NULL,
    "usersIncluded" INTEGER NOT NULL DEFAULT 1,
    "overagePerUnit" INTEGER,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaidService" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creditCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "serviceKey" TEXT,
    "note" TEXT,
    "periodKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PaidService_key_key" ON "PaidService"("key");

-- CreateIndex
CREATE INDEX "CreditEntry_userId_createdAt_idx" ON "CreditEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_userId_periodKey_key" ON "CreditEntry"("userId", "periodKey");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
