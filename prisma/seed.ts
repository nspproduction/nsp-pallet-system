// Seed script for demo/development.
// Run: npm run db:seed
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { moveStock } from "../lib/server/stock";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  // ---------- Departments ----------
  // คลังพาเลท = isWarehouse true (warehouse dept that holds pallet stock)
  const deptDefs = [
    { name: "คลังพาเลท",    isWarehouse: true },
    { name: "พัสดุ",        isWarehouse: false },
    { name: "ผลิต",         isWarehouse: false },
    { name: "จ่ายสินค้า",   isWarehouse: false },
    { name: "ควบคุมคุณภาพ", isWarehouse: false },
    { name: "เทคโนโลยี",    isWarehouse: false },
  ];
  for (const d of deptDefs) {
    const existing = await prisma.department.findFirst({ where: { name: d.name } });
    if (!existing) await prisma.department.create({ data: d });
  }
  const [whPl, wh, pd, disp] = await Promise.all([
    prisma.department.findFirst({ where: { isWarehouse: true } }),
    prisma.department.findFirst({ where: { name: "พัสดุ" } }),
    prisma.department.findFirst({ where: { name: "ผลิต" } }),
    prisma.department.findFirst({ where: { name: "จ่ายสินค้า" } }),
  ]);

  // ---------- Users ----------
  // Default dev password: Noritake@2026
  const defaultHash = await hashPassword("Noritake@2026");
  const users = [
    { email: "admin@noritake.local",    fullName: "Admin",                  roles: [UserRole.ADMIN],          status: "ACTIVE" as const, departmentId: whPl?.id ?? null },
    { email: "manager@noritake.local",  fullName: "หัวหน้าคลังพาเลท ทดสอบ",  roles: [UserRole.PALLET_MANAGER], status: "ACTIVE" as const, departmentId: whPl?.id ?? null },
    { email: "supply1@noritake.local",  fullName: "พนักงานพัสดุ ทดสอบ",      roles: [UserRole.REQUESTER],      status: "ACTIVE" as const, departmentId: wh?.id   ?? null },
    { email: "produce1@noritake.local", fullName: "พนักงานผลิต ทดสอบ",       roles: [UserRole.REQUESTER],      status: "ACTIVE" as const, departmentId: pd?.id   ?? null },
    { email: "dispatch1@noritake.local",fullName: "พนักงานจ่ายสินค้า ทดสอบ", roles: [UserRole.REQUESTER],      status: "ACTIVE" as const, departmentId: disp?.id ?? null },
  ];
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: {
          fullName: u.fullName,
          roles: u.roles,
          status: u.status,
          departmentId: u.departmentId,
          // reset password only if not yet set (first seed after migrate reset)
          ...(existing.passwordHash ? {} : { passwordHash: defaultHash }),
        },
      });
    } else {
      await prisma.user.create({ data: { ...u, passwordHash: defaultHash } });
    }
  }

  // ---------- Pallet types ----------
  const palletTypes = [
    { name: "พาเลทไม้มาตรฐาน 100x120", sizeSpec: "100x120x15"  },
    { name: "พาเลทไม้ EURO 80x120",    sizeSpec: "80x120x15"   },
    { name: "พาเลทพลาสติกน้ำเงิน",     sizeSpec: "110x110x15"  },
    { name: "พาเลทพลาสติกดำ",          sizeSpec: "100x120x15"  },
    { name: "พาเลทเหล็กแบบกรง",        sizeSpec: "120x100x100" },
  ];
  for (const p of palletTypes) {
    const existing = await prisma.palletType.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.palletType.update({ where: { id: existing.id }, data: { sizeSpec: p.sizeSpec } });
    } else {
      await prisma.palletType.create({ data: p });
    }
  }

  // ---------- Initial stock ----------
  const whMain = whPl;
  const existingMovements = await prisma.stockMovement.count();
  if (existingMovements === 0 && whMain) {
    const palletQtys: Record<string, number> = {
      "พาเลทไม้มาตรฐาน 100x120": 500,
      "พาเลทไม้ EURO 80x120":    200,
      "พาเลทพลาสติกน้ำเงิน":     300,
      "พาเลทพลาสติกดำ":          150,
      "พาเลทเหล็กแบบกรง":        30,
    };
    for (const [name, qty] of Object.entries(palletQtys)) {
      const pt = await prisma.palletType.findFirst({ where: { name } });
      if (!pt) continue;
      await prisma.$transaction(async (tx) => {
        await moveStock(tx, {
          palletTypeId: pt.id,
          condition: "GOOD",
          delta: qty,
          toDepartmentId: whMain.id,
          reason: "[SEED] Initial stock",
        });
      });
    }
    console.log(`  ✅ seeded initial stock (${Object.keys(palletQtys).length} lines)`);
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
