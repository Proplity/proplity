-- CreateEnum
CREATE TYPE "LateFeeType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET DEFAULT ('INV-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "lateFeeFlatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lateFeeType" "LateFeeType" NOT NULL DEFAULT 'PERCENTAGE',
ALTER COLUMN "lateFeePercentage" SET DEFAULT 0;
