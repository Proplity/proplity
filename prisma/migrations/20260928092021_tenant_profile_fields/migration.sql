-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET DEFAULT ('INV-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "idDocumentUrl" TEXT,
ADD COLUMN     "previousLandlordEmail" TEXT,
ADD COLUMN     "previousLandlordPhone" TEXT;
