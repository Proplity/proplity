-- Vendors sign themselves up; an admin vets the business before it is listed (ISS-043).
CREATE TYPE "VendorVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "VendorProfile"
  ADD COLUMN "verificationStatus" "VendorVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT;

-- Profiles that already exist were listed before this gate: keep them visible.
UPDATE "VendorProfile" SET "verificationStatus" = 'VERIFIED', "verifiedAt" = NOW();
