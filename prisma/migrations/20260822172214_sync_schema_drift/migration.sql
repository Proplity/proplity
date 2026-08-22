-- AlterEnum
BEGIN;
CREATE TYPE "InvoiceType_new" AS ENUM ('RENT', 'MAINTENANCE', 'SECURITY_DEPOSIT', 'UTILITY', 'LATE_FEE', 'ASSOCIATION_FEE', 'SUBSCRIPTION');
ALTER TABLE "public"."Invoice" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "type" TYPE "InvoiceType_new" USING ("type"::text::"InvoiceType_new");
ALTER TYPE "InvoiceType" RENAME TO "InvoiceType_old";
ALTER TYPE "InvoiceType_new" RENAME TO "InvoiceType";
DROP TYPE "public"."InvoiceType_old";
ALTER TABLE "Invoice" ALTER COLUMN "type" SET DEFAULT 'RENT';
COMMIT;

-- AlterEnum
ALTER TYPE "NoticeType" ADD VALUE 'TERMINATION_NOTICE';

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET DEFAULT ('INV-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "viewedAt" TIMESTAMP(3);

