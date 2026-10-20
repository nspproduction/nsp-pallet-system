-- CreateTable
CREATE TABLE "department_stock" (
    "palletTypeId" TEXT NOT NULL,
    "condition" "PalletCondition" NOT NULL,
    "departmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "department_stock_pkey" PRIMARY KEY ("palletTypeId","condition","departmentId")
);

-- AddForeignKey
ALTER TABLE "department_stock" ADD CONSTRAINT "department_stock_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "pallet_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_stock" ADD CONSTRAINT "department_stock_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
