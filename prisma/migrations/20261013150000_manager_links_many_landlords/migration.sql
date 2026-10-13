-- A manager can link to several landlords (ISS-040): one redeemed code per
-- landlord, so linkedManagerId is no longer unique. A code is still
-- single-use, enforced by the redeem/register writes (WHERE linkedManagerId IS NULL).
DROP INDEX "ManagerInviteCode_linkedManagerId_key";
CREATE INDEX "ManagerInviteCode_linkedManagerId_idx" ON "ManagerInviteCode"("linkedManagerId");
