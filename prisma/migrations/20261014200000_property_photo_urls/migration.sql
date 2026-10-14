-- ISS-014: every uploaded room and exterior photo is kept, not just the first.
ALTER TABLE "Property" ADD COLUMN "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
