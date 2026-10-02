import { prisma } from "@/lib/prisma";
import type { PalletCondition } from "@prisma/client";

// Balance at a department for one (palletType, condition) bucket.
// balance = sum(in.quantity) - sum(out.quantity)
export async function getBalance(params: {
  palletTypeId: string;
  condition: PalletCondition;
  departmentId: string;
}): Promise<number> {
  const [inSum, outSum] = await Promise.all([
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: {
        palletTypeId: params.palletTypeId,
        condition: params.condition,
        toDepartmentId: params.departmentId,
      },
    }),
    prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: {
        palletTypeId: params.palletTypeId,
        condition: params.condition,
        fromDepartmentId: params.departmentId,
      },
    }),
  ]);
  return (inSum._sum.quantity ?? 0) - (outSum._sum.quantity ?? 0);
}

// Aggregate current on-hand for a whole department.
export async function getDepartmentBalances(departmentId: string) {
  const [ins, outs] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ["palletTypeId", "condition"],
      _sum: { quantity: true },
      where: { toDepartmentId: departmentId },
    }),
    prisma.stockMovement.groupBy({
      by: ["palletTypeId", "condition"],
      _sum: { quantity: true },
      where: { fromDepartmentId: departmentId },
    }),
  ]);

  const key = (p: string, c: string) => `${p}::${c}`;
  const bal = new Map<string, number>();
  for (const row of ins) bal.set(key(row.palletTypeId, row.condition), row._sum.quantity ?? 0);
  for (const row of outs) {
    const k = key(row.palletTypeId, row.condition);
    bal.set(k, (bal.get(k) ?? 0) - (row._sum.quantity ?? 0));
  }
  return Array.from(bal.entries()).map(([k, quantity]) => {
    const [palletTypeId, condition] = k.split("::");
    return { palletTypeId, condition: condition as PalletCondition, quantity };
  });
}
