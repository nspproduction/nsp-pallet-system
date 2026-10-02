import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestType } from "@prisma/client";

// Maps request type → short code embedded into docNo (PL-<CODE>-<yymm>-<seq>).
const TYPE_CODE: Record<RequestType, string> = {
  RECEIVE_NEW: "IN",
  ISSUE_INTERNAL: "OUT",
  RETURN_INTERNAL: "RTN",
  TRANSFER_INTERNAL: "TRF",
  SHIP_CUSTOMER: "SHP",
  RETURN_CUSTOMER: "RCV",
  SEND_REPAIR: "REP",
  RECEIVE_REPAIR: "RRP",
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
export async function nextDocNo(type: RequestType, at: Date = new Date()): Promise<string> {
  const code = TYPE_CODE[type];
  const period = yymm(at);
  const key = `${code}-${period}`;

  const rows = await prisma.$queryRaw<{ seq: number }[]>(Prisma.sql`
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
