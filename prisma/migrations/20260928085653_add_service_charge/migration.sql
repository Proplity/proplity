-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'SERVICE_CHARGE';

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET DEFAULT ('INV-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "serviceCharge" DOUBLE PRECISION DEFAULT 0;
