// Global test setup — runs before each test file
// Mocks the Prisma client so tests don't need a real DB connection
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    stockMovement: { aggregate: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    warehouseOperation: { create: vi.fn() },
    warehouseStock: { findUnique: vi.fn(), findMany: vi.fn() },
    palletType: { findMany: vi.fn() },
    request: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    requestItem: { aggregate: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    department: { findUnique: vi.fn(), findFirst: vi.fn() },
    approvalRoute: { findFirst: vi.fn() },
    operatingHours: { findMany: vi.fn() },
    holidayDate: { findFirst: vi.fn() },
    emailOutbox: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    approval: { create: vi.fn(), findFirst: vi.fn() },
    requestRevision: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
