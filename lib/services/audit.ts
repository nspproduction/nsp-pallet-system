import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function writeAudit(params: {
  userId?: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      before: params.before as Prisma.InputJsonValue | undefined,
      after: params.after as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

export async function listAuditLogs(
  filter: { entity?: string; entityId?: string; userId?: string; limit?: number; offset?: number } = {},
) {
  return prisma.auditLog.findMany({
    where: {
      entity: filter.entity,
      entityId: filter.entityId,
      userId: filter.userId,
    },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 100,
    skip: filter.offset ?? 0,
  });
}
