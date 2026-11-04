-- "Lease" becomes "Rent" everywhere (owner decision, 2026-10-23). Pure renames, so existing rows
-- are kept: types and enum values, the two tables, every leaseId column, then the primary keys,
-- foreign keys and indexes whose names Prisma derives from the old names.

ALTER TYPE "LeaseStatus" RENAME TO "RentStatus";
ALTER TYPE "ConversationType" RENAME VALUE 'LEASE_THREAD' TO 'RENT_THREAD';

ALTER TABLE "Lease" RENAME TO "Rent";
ALTER TABLE "LeaseSignature" RENAME TO "RentSignature";

ALTER TABLE "Application" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "AutoPayMandate" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "Conversation" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "Invoice" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "RentSignature" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "Note" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "Notice" RENAME COLUMN "leaseId" TO "rentId";
ALTER TABLE "PropertyReview" RENAME COLUMN "leaseId" TO "rentId";

-- Primary keys (renaming the constraint renames its index too) and foreign keys
ALTER TABLE "Rent" RENAME CONSTRAINT "Lease_pkey" TO "Rent_pkey";
ALTER TABLE "Rent" RENAME CONSTRAINT "Lease_renewedFromId_fkey" TO "Rent_renewedFromId_fkey";
ALTER TABLE "Rent" RENAME CONSTRAINT "Lease_tenantId_fkey" TO "Rent_tenantId_fkey";
ALTER TABLE "Rent" RENAME CONSTRAINT "Lease_unitId_fkey" TO "Rent_unitId_fkey";
ALTER TABLE "RentSignature" RENAME CONSTRAINT "LeaseSignature_pkey" TO "RentSignature_pkey";
ALTER TABLE "RentSignature" RENAME CONSTRAINT "LeaseSignature_leaseId_fkey" TO "RentSignature_rentId_fkey";
ALTER TABLE "RentSignature" RENAME CONSTRAINT "LeaseSignature_signerId_fkey" TO "RentSignature_signerId_fkey";
ALTER TABLE "Application" RENAME CONSTRAINT "Application_leaseId_fkey" TO "Application_rentId_fkey";
ALTER TABLE "AutoPayMandate" RENAME CONSTRAINT "AutoPayMandate_leaseId_fkey" TO "AutoPayMandate_rentId_fkey";
ALTER TABLE "Conversation" RENAME CONSTRAINT "Conversation_leaseId_fkey" TO "Conversation_rentId_fkey";
ALTER TABLE "Invoice" RENAME CONSTRAINT "Invoice_leaseId_fkey" TO "Invoice_rentId_fkey";
ALTER TABLE "Note" RENAME CONSTRAINT "Note_leaseId_fkey" TO "Note_rentId_fkey";
ALTER TABLE "Notice" RENAME CONSTRAINT "Notice_leaseId_fkey" TO "Notice_rentId_fkey";
ALTER TABLE "PropertyReview" RENAME CONSTRAINT "PropertyReview_leaseId_fkey" TO "PropertyReview_rentId_fkey";

-- Indexes that are not backed by a constraint
ALTER INDEX "AutoPayMandate_leaseId_status_idx" RENAME TO "AutoPayMandate_rentId_status_idx";
ALTER INDEX "AutoPayMandate_one_active_per_lease" RENAME TO "AutoPayMandate_one_active_per_rent";
ALTER INDEX "Invoice_leaseId_idx" RENAME TO "Invoice_rentId_idx";
ALTER INDEX "LeaseSignature_leaseId_signerId_key" RENAME TO "RentSignature_rentId_signerId_key";
ALTER INDEX "Lease_renewedFromId_key" RENAME TO "Rent_renewedFromId_key";
ALTER INDEX "Lease_tenantId_idx" RENAME TO "Rent_tenantId_idx";
ALTER INDEX "Lease_unitId_status_idx" RENAME TO "Rent_unitId_status_idx";
ALTER INDEX "Notice_leaseId_type_idx" RENAME TO "Notice_rentId_type_idx";
ALTER INDEX "PropertyReview_leaseId_idx" RENAME TO "PropertyReview_rentId_idx";
