-- Two admin switches for the two-person rule on payments the property team records by hand: one
-- for what a tenant owes, one for what the team owes a vendor. Both default to on, so nothing
-- changes for an existing deployment until an admin turns one off.
ALTER TABLE "SystemSettings" ADD COLUMN     "requireSecondPersonForTenantPayments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requireSecondPersonForVendorPayments" BOOLEAN NOT NULL DEFAULT true;
