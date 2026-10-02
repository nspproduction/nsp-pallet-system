// Seed script for demo/development.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // ---------- Departments ----------
  // "WH-PL" is the pallet warehouse itself (balance in warehouse = pallets at this dept).
  // "WH" (พัสดุ) is the materials dept — only this dept can create RECEIVE_NEW.
  const departments = [
    { code: "WH-PL", name: "คลังพาเลท" },
    { code: "WH",    name: "พัสดุ" },
    { code: "PD",    name: "ผลิต" },
    { code: "DISP",  name: "จ่ายสินค้า" },
    { code: "QA",    name: "ควบคุมคุณภาพ" },
    { code: "RD",    name: "เทคโนโลยี" },
  ];
  for (const d of departments) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }
  const [whPl, wh, pd, disp] = await Promise.all([
    prisma.department.findUnique({ where: { code: "WH-PL" } }),
    prisma.department.findUnique({ where: { code: "WH" } }),
    prisma.department.findUnique({ where: { code: "PD" } }),
    prisma.department.findUnique({ where: { code: "DISP" } }),
  ]);

  // ---------- Users ----------
  const users = [
    { employeeCode: "EMP-ADMIN",   fullName: "Admin",                      role: "ADMIN"     as const, status: "ACTIVE" as const, departmentId: whPl?.id ?? null },
    { employeeCode: "EMP-APR-01",  fullName: "หัวหน้าคลังพาเลท ทดสอบ",      role: "APPROVER"  as const, status: "ACTIVE" as const, departmentId: whPl?.id ?? null },
    { employeeCode: "EMP-WH-01",   fullName: "พนักงานพัสดุ ทดสอบ",          role: "REQUESTER" as const, status: "ACTIVE" as const, departmentId: wh?.id   ?? null },
    { employeeCode: "EMP-PD-01",   fullName: "พนักงานผลิต ทดสอบ",           role: "REQUESTER" as const, status: "ACTIVE" as const, departmentId: pd?.id   ?? null },
    { employeeCode: "EMP-DISP-01", fullName: "พนักงานจ่ายสินค้า ทดสอบ",     role: "REQUESTER" as const, status: "ACTIVE" as const, departmentId: disp?.id ?? null },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { employeeCode: u.employeeCode },
      update: { fullName: u.fullName, role: u.role, status: u.status, departmentId: u.departmentId },
      create: u,
    });
  }

  // ---------- Pallet types ----------
  const palletTypes = [
    { code: "WOOD-STD",     name: "พาเลทไม้มาตรฐาน 100x120", material: "ไม้",     sizeSpec: "100x120x15", minStock: 100 },
    { code: "WOOD-EURO",    name: "พาเลทไม้ EURO 80x120",    material: "ไม้",     sizeSpec: "80x120x15",  minStock: 50 },
    { code: "PLASTIC-BLUE", name: "พาเลทพลาสติกน้ำเงิน",     material: "พลาสติก", sizeSpec: "110x110x15", minStock: 80 },
    { code: "PLASTIC-BLK",  name: "พาเลทพลาสติกดำ",          material: "พลาสติก", sizeSpec: "100x120x15", minStock: 40 },
    { code: "STEEL-CAGE",   name: "พาเลทเหล็กแบบกรง",        material: "เหล็ก",   sizeSpec: "120x100x100", minStock: 10 },
  ];
  for (const p of palletTypes) {
    await prisma.palletType.upsert({ where: { code: p.code }, update: p, create: p });
  }

  // ---------- Initial stock (seed as RECEIVE_NEW movements → WH-PL) ----------
  const whMain = whPl;
  const existingMovements = await prisma.stockMovement.count();
  if (existingMovements === 0 && whMain) {
    const palletCodes = ["WOOD-STD", "WOOD-EURO", "PLASTIC-BLUE", "PLASTIC-BLK", "STEEL-CAGE"];
    const qtys: Record<string, number> = {
      "WOOD-STD": 500,
      "WOOD-EURO": 200,
      "PLASTIC-BLUE": 300,
      "PLASTIC-BLK": 150,
      "STEEL-CAGE": 30,
    };
    for (const code of palletCodes) {
      const pt = await prisma.palletType.findUnique({ where: { code } });
      if (!pt) continue;
      await prisma.stockMovement.create({
        data: {
          palletTypeId: pt.id,
          condition: "USABLE",
          quantity: qtys[code] ?? 0,
          toDepartmentId: whMain.id,
          reason: "[SEED] Initial stock",
        },
      });
    }
    console.log(`  ✅ seeded initial stock (${palletCodes.length} lines)`);
  } else {
    console.log(`  ⏭  skip initial stock (${existingMovements} movements exist)`);
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
