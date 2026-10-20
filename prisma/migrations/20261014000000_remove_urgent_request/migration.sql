-- Remove urgent request feature
ALTER TABLE "requests" DROP COLUMN IF EXISTS "isUrgent";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "urgentReason";
