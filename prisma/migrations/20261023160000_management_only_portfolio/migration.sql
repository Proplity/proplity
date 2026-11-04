-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "managementOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "inviteTenantsToManagementOnly" BOOLEAN NOT NULL DEFAULT true;
