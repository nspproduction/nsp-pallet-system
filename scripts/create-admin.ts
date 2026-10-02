// Create or update an admin user with a hashed password.
// Usage:
//   npm run create-admin -- <employeeCode> <password> [fullName]
// or:
//   npx tsx scripts/create-admin.ts <employeeCode> <password> [fullName]
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const [, , employeeCode, password, fullNameArg] = process.argv;
  if (!employeeCode || !password) {
    console.error("Usage: tsx scripts/create-admin.ts <employeeCode> <password> [fullName]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { employeeCode } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "ADMIN",
          status: "ACTIVE",
          passwordHash,
          ...(fullNameArg ? { fullName: fullNameArg } : {}),
        },
      });
      console.log(`Updated admin: ${updated.fullName} (${updated.employeeCode})`);
    } else {
      const created = await prisma.user.create({
        data: {
          employeeCode,
          fullName: fullNameArg ?? employeeCode,
          role: "ADMIN",
          status: "ACTIVE",
          passwordHash,
        },
      });
      console.log(`Created admin: ${created.fullName} (${created.employeeCode})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
