-- Add Department.requiresReturnSource flag and Request.returnSource enum column.
-- When a department has requiresReturnSource=true, RETURN requests from its
-- requesters must specify returnSource (INTERNAL = ใช้ภายใน / CUSTOMER = ลูกค้า).

CREATE TYPE "ReturnSource" AS ENUM ('INTERNAL', 'CUSTOMER');

ALTER TABLE "departments" ADD COLUMN "requiresReturnSource" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "requests" ADD COLUMN "returnSource" "ReturnSource";
