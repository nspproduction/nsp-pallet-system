/*
  Warnings:

  - The values [NEW_STOCK] on the enum `WarehouseOpType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `code` on the `pallet_types` table. All the data in the column will be lost.
  - You are about to drop the column `lengthCm` on the `pallet_types` table. All the data in the column will be lost.
  - You are about to drop the column `material` on the `pallet_types` table. All the data in the column will be lost.
  - You are about to drop the column `widthCm` on the `pallet_types` table. All the data in the column will be lost.
  - You are about to drop the `attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `locations` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `pallet_types` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WarehouseOpType_new" AS ENUM ('REPAIR_RESULT', 'WRITE_OFF', 'ADJUSTMENT');
ALTER TABLE "warehouse_operations" ALTER COLUMN "type" TYPE "WarehouseOpType_new" USING ("type"::text::"WarehouseOpType_new");
ALTER TYPE "WarehouseOpType" RENAME TO "WarehouseOpType_old";
ALTER TYPE "WarehouseOpType_new" RENAME TO "WarehouseOpType";
DROP TYPE "public"."WarehouseOpType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_requestId_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_warehouseOpId_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_operation_items" DROP CONSTRAINT "warehouse_operation_items_operationId_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_operation_items" DROP CONSTRAINT "warehouse_operation_items_palletTypeId_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_operations" DROP CONSTRAINT "warehouse_operations_createdById_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_stock" DROP CONSTRAINT "warehouse_stock_palletTypeId_fkey";

-- DropIndex
DROP INDEX "pallet_types_code_key";

-- AlterTable
ALTER TABLE "approval_routes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "approval_steps" ALTER COLUMN "approverIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "department_sections" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pallet_types" DROP COLUMN "code",
DROP COLUMN "lengthCm",
DROP COLUMN "material",
DROP COLUMN "widthCm";

-- DropTable
DROP TABLE "attachments";

-- DropTable
DROP TABLE "locations";

-- DropEnum
DROP TYPE "LocationType";

-- CreateIndex
CREATE INDEX "department_sections_departmentId_idx" ON "department_sections"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "pallet_types_name_key" ON "pallet_types"("name");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- AddForeignKey
ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_operations" ADD CONSTRAINT "warehouse_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_operation_items" ADD CONSTRAINT "warehouse_operation_items_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "warehouse_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_operation_items" ADD CONSTRAINT "warehouse_operation_items_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseOpId_fkey" FOREIGN KEY ("warehouseOpId") REFERENCES "warehouse_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
