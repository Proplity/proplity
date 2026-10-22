-- AlterTable: how many new people one manager or landlord may invite by email per day (ISS-154)
ALTER TABLE "SystemSettings" ADD COLUMN "tenantInvitesPerDay" INTEGER NOT NULL DEFAULT 10;
