-- Drop unique constraint that depends on code column
ALTER TABLE "department_sections" DROP CONSTRAINT IF EXISTS "department_sections_departmentId_code_key";

-- Drop code column
ALTER TABLE "department_sections" DROP COLUMN IF EXISTS "code";
