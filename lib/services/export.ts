import ExcelJS from "exceljs";
import {
  DashboardFilter,
  getWarehouseMovements,
  getIssueReturnByDepartment,
  getIssueReturnByPerson,
  getRepairQuality,
} from "@/lib/services/dashboard";
import { getWarehouseConditionSummary } from "@/lib/services/warehouse";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headerRow(ws: ExcelJS.Worksheet, cols: string[]) {
  const row = ws.addRow(cols);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
  row.alignment = { horizontal: "center" };
}

function setColWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function numFmt(ws: ExcelJS.Worksheet, colIndex: number, fmt = "#,##0") {
  ws.getColumn(colIndex).numFmt = fmt;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function exportDashboardExcel(filter?: DashboardFilter): Promise<ArrayBuffer> {
  const [warehouse, movements, deptStats, personStats, repairStats] = await Promise.all([
    getWarehouseConditionSummary(),
    getWarehouseMovements(filter),
    getIssueReturnByDepartment(filter),
    getIssueReturnByPerson(filter),
    getRepairQuality(filter),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pallet System";
  wb.created = new Date();

  // ── Sheet 1: ยอดในคลัง แยกตามสภาพ ──────────────────────────────────────────
  const wsStock = wb.addWorksheet("ยอดในคลัง");
  headerRow(wsStock, ["ชนิดพาเลท", "ดี", "รอซ่อม", "เสีย"]);
  setColWidths(wsStock, [36, 12, 14, 12]);
  for (let c = 2; c <= 4; c++) numFmt(wsStock, c);

  for (const row of warehouse) {
    wsStock.addRow([
      row.active ? row.name : `${row.name} (ปิดการใช้งาน)`,
      row.usable,
      row.inRepair,
      row.unusable,
    ]);
  }

  // ── Sheet 2: การเคลื่อนไหวของคลัง (ใหม่สุดก่อน) ──────────────────────────
  const wsMove = wb.addWorksheet("การเคลื่อนไหวของคลัง");
  headerRow(wsMove, [
    "วันที่", "เบิกออก",
    "คืน-ดี", "คืน-รอซ่อม", "คืน-เสีย",
    "ซ่อม-ดี", "ซ่อม-เสีย",
    "ตัด", "ปรับ",
  ]);
  setColWidths(wsMove, [14, 12, 12, 14, 12, 12, 14, 10, 10]);
  for (let c = 2; c <= 9; c++) numFmt(wsMove, c);

  const movementsDesc = [...movements].sort((a, b) => b.date.localeCompare(a.date));
  for (const r of movementsDesc) {
    wsMove.addRow([
      r.date, r.issueOut,
      r.returnGood, r.returnRepair, r.returnDamaged,
      r.repairGood, r.repairDamaged,
      r.writeOff, r.adjustment,
    ]);
  }

  // ── Sheet 3: รายแผนก ──────────────────────────────────────────────────────
  const wsDept = wb.addWorksheet("รายแผนก");
  headerRow(wsDept, ["แผนก", "เบิก", "คืน-ดี", "คืน-รอซ่อม", "คืน-เสีย"]);
  setColWidths(wsDept, [30, 12, 12, 14, 12]);
  for (let c = 2; c <= 5; c++) numFmt(wsDept, c);

  for (const r of deptStats) {
    wsDept.addRow([
      r.departmentName,
      r.issueQty,
      r.returnGoodQty,
      r.returnRepairQty,
      r.returnDamagedQty,
    ]);
  }

  // ── Sheet 4: รายคน ────────────────────────────────────────────────────────
  const wsPerson = wb.addWorksheet("รายคน");
  headerRow(wsPerson, ["ชื่อ", "แผนก", "คำขอ", "เบิก", "คืน"]);
  setColWidths(wsPerson, [30, 25, 12, 12, 12]);
  for (let c = 3; c <= 5; c++) numFmt(wsPerson, c);

  for (const r of personStats) {
    wsPerson.addRow([r.fullName, r.departmentName, r.requestCount, r.issueQty, r.returnQty]);
  }

  // ── Sheet 5: คุณภาพการซ่อม ───────────────────────────────────────────────
  const wsRepair = wb.addWorksheet("คุณภาพการซ่อม");
  headerRow(wsRepair, [
    "ประเภทพาเลท",
    "ส่งซ่อม", "ซ่อม-ดี", "ซ่อม-เสีย",
    "อัตราสำเร็จ (%)",
  ]);
  setColWidths(wsRepair, [30, 14, 14, 14, 18]);
  for (let c = 2; c <= 4; c++) numFmt(wsRepair, c);
  numFmt(wsRepair, 5, "0.00");

  for (const r of repairStats) {
    wsRepair.addRow([
      r.palletTypeName,
      r.totalRepaired,
      r.repairedGood,
      r.repairedDamaged,
      +(r.repairRate * 100).toFixed(2),
    ]);
  }

  const raw = await wb.xlsx.writeBuffer();
  // exceljs types return an opaque Buffer; copy to a plain ArrayBuffer for BodyInit
  const ab = new ArrayBuffer((raw as unknown as { byteLength: number }).byteLength);
  new Uint8Array(ab).set(raw as unknown as Uint8Array);
  return ab;
}
