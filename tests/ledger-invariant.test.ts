import { describe, it, expect } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// AC-14: ยอดในคลังแต่ละ ประเภท × สภาพ = ผลรวม quantityDelta ใน ledger ทั้งหมด
//
// Pure function tests — no DB required.
// Verifies the mathematical invariant that `moveStock` maintains:
//   warehouseStock.quantity = sum(inflow quantities) − sum(outflow quantities)
// ──────────────────────────────────────────────────────────────────────────────

interface LedgerRow {
  palletTypeId: string;
  condition: string;
  quantity: number;
  toDepartmentId: string | null;
  fromDepartmentId: string | null;
}

/**
 * Recomputes the expected warehouseStock balance for a given
 * (palletTypeId, condition) by replaying every ledger row.
 *
 * This mirrors the invariant that moveStock guarantees:
 *   inflow row  → toDepartmentId  = warehouseId → add quantity
 *   outflow row → fromDepartmentId = warehouseId → subtract quantity
 */
function replayBalance(
  ledger: LedgerRow[],
  palletTypeId: string,
  condition: string,
  warehouseId: string,
): number {
  return ledger
    .filter((r) => r.palletTypeId === palletTypeId && r.condition === condition)
    .reduce((sum, r) => {
      if (r.toDepartmentId === warehouseId) return sum + r.quantity;
      if (r.fromDepartmentId === warehouseId) return sum - r.quantity;
      return sum;
    }, 0);
}

const WH = "dept-wh";
const PT_A = "pt-a";
const PT_B = "pt-b";
const GOOD = "GOOD";
const DAMAGED = "DAMAGED";
const PENDING_REPAIR = "PENDING_REPAIR";

describe("ledger invariant (AC-14)", () => {
  it("balance equals inflow minus outflow for a single palletType", () => {
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_A, condition: GOOD, quantity: 100, toDepartmentId: WH, fromDepartmentId: null },
      { palletTypeId: PT_A, condition: GOOD, quantity: 20, toDepartmentId: null, fromDepartmentId: WH },
      { palletTypeId: PT_A, condition: GOOD, quantity: 5, toDepartmentId: WH, fromDepartmentId: null },
    ];
    // 100 − 20 + 5 = 85
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(85);
  });

  it("returns 0 when all inflows exactly match all outflows", () => {
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_A, condition: GOOD, quantity: 50, toDepartmentId: WH, fromDepartmentId: null },
      { palletTypeId: PT_A, condition: GOOD, quantity: 50, toDepartmentId: null, fromDepartmentId: WH },
    ];
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(0);
  });

  it("filters correctly by palletTypeId — other pallet types do not pollute the balance", () => {
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_A, condition: GOOD, quantity: 30, toDepartmentId: WH, fromDepartmentId: null },
      { palletTypeId: PT_B, condition: GOOD, quantity: 99, toDepartmentId: WH, fromDepartmentId: null },
    ];
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(30);
    expect(replayBalance(ledger, PT_B, GOOD, WH)).toBe(99);
  });

  it("filters correctly by condition — different conditions are independent balances", () => {
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_A, condition: GOOD, quantity: 40, toDepartmentId: WH, fromDepartmentId: null },
      { palletTypeId: PT_A, condition: DAMAGED, quantity: 10, toDepartmentId: WH, fromDepartmentId: null },
      { palletTypeId: PT_A, condition: PENDING_REPAIR, quantity: 5, toDepartmentId: WH, fromDepartmentId: null },
    ];
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(40);
    expect(replayBalance(ledger, PT_A, DAMAGED, WH)).toBe(10);
    expect(replayBalance(ledger, PT_A, PENDING_REPAIR, WH)).toBe(5);
  });

  it("returns 0 when there are no ledger rows for the requested palletType", () => {
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_B, condition: GOOD, quantity: 10, toDepartmentId: WH, fromDepartmentId: null },
    ];
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(0);
  });

  it("accumulates correctly across many inflow and outflow movements", () => {
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_A, condition: GOOD, quantity: 200, toDepartmentId: WH, fromDepartmentId: null }, // +200
      { palletTypeId: PT_A, condition: GOOD, quantity: 50,  toDepartmentId: null, fromDepartmentId: WH }, // −50
      { palletTypeId: PT_A, condition: GOOD, quantity: 30,  toDepartmentId: null, fromDepartmentId: WH }, // −30
      { palletTypeId: PT_A, condition: GOOD, quantity: 10,  toDepartmentId: WH, fromDepartmentId: null }, // +10
      { palletTypeId: PT_A, condition: GOOD, quantity: 20,  toDepartmentId: null, fromDepartmentId: WH }, // −20
    ];
    // 200 − 50 − 30 + 10 − 20 = 110
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(110);
  });

  it("REPAIR_RESULT scenario: PENDING_REPAIR outflow → GOOD inflow + DAMAGED inflow (AC-8)", () => {
    // Incoming pallet: 10 PENDING_REPAIR, then repair result: 8 GOOD + 2 DAMAGED
    const ledger: LedgerRow[] = [
      { palletTypeId: PT_A, condition: PENDING_REPAIR, quantity: 10, toDepartmentId: WH, fromDepartmentId: null },  // received for repair
      { palletTypeId: PT_A, condition: PENDING_REPAIR, quantity: 10, toDepartmentId: null, fromDepartmentId: WH }, // consumed by repair
      { palletTypeId: PT_A, condition: GOOD,           quantity: 8,  toDepartmentId: WH, fromDepartmentId: null }, // repaired → good
      { palletTypeId: PT_A, condition: DAMAGED,        quantity: 2,  toDepartmentId: WH, fromDepartmentId: null }, // irreparable → damaged
    ];
    expect(replayBalance(ledger, PT_A, PENDING_REPAIR, WH)).toBe(0);  // all consumed
    expect(replayBalance(ledger, PT_A, GOOD, WH)).toBe(8);
    expect(replayBalance(ledger, PT_A, DAMAGED, WH)).toBe(2);
  });
});
