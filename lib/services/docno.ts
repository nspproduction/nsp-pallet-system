import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestType, WarehouseOpType } from "@prisma/client";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Maps request type → short code embedded into docNo (PL-<CODE>-<yymm>-<seq>).
const TYPE_CODE: Record<RequestType, string> = {
  ISSUE: "ISS",
  RETURN: "RET",
};

// Maps warehouse operation type → short code.
const WO_TYPE_CODE: Record<WarehouseOpType, string> = {
  REPAIR_RESULT: "REP",
  WRITE_OFF: "WOF",
  ADJUSTMENT: "ADJ",
};

function yymm(d = new Date()): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

// Uses upsert with atomic increment via raw SQL to avoid races.
// Table doc_counters(key text PK, seq int) is created by migration.
export async function nextDocNo(type: RequestType, at: Date = new Date(), tx?: TxClient): Promise<string> {
  const code = TYPE_CODE[type];
  const period = yymm(at);
  const key = `${code}-${period}`;
  const db = tx ?? prisma;

  const rows = await db.$queryRaw<{ seq: number }[]>(Prisma.sql`
    INSERT INTO doc_counters ("key", seq, "updatedAt")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET seq = doc_counters.seq + 1,
          "updatedAt" = NOW()
    RETURNING seq
  `);
  const seq = rows[0]?.seq ?? 1;

  return `PL-${code}-${period}-${String(seq).padStart(4, "0")}`;
}

export async function nextWarehouseOpDocNo(type: WarehouseOpType, at: Date = new Date()): Promise<string> {
  const code = WO_TYPE_CODE[type];
  const period = yymm(at);
  const key = `WO-${code}-${period}`;

  const rows = await prisma.$queryRaw<{ seq: number }[]>(Prisma.sql`
    INSERT INTO doc_counters ("key", seq, "updatedAt")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET seq = doc_counters.seq + 1,
          "updatedAt" = NOW()
    RETURNING seq
  `);
  const seq = rows[0]?.seq ?? 1;

  return `WO-${code}-${period}-${String(seq).padStart(4, "0")}`;
}
