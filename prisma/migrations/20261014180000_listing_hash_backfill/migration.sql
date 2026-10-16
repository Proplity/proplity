-- ISS-025: fingerprint existing listings (same rule as lib/propertyFingerprint.ts)
-- and index it so duplicate lookups are cheap.
UPDATE "Property"
SET "listingHash" = encode(
  sha256(convert_to(regexp_replace(lower("address" || '|' || "city"), '[^a-z0-9|]', '', 'g'), 'UTF8')),
  'hex'
)
WHERE "listingHash" IS NULL;

CREATE INDEX "Property_listingHash_idx" ON "Property"("listingHash");
