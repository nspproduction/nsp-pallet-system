-- Drop FK constraint for requesterSectionId before dropping the column
ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "requests_requesterSectionId_fkey";

-- Drop unused columns from requests table
ALTER TABLE "requests" DROP COLUMN IF EXISTS "departmentId";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "sectionId";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "requesterSectionId";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "referenceNo";
