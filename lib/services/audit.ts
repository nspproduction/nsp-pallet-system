import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/current-user";
import type { SessionUser } from "@/lib/auth/current-user";

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
  let { ipAddress, userAgent } = params;
  // If the caller didn't pass ip/ua, try to pull them from the current request.
  // Safe to skip when we're outside a request context (tests, scripts).
  if (ipAddress === undefined || userAgent === undefined) {
    try {
      const h = await headers();
      if (ipAddress === undefined) {
        const forwarded = h.get("x-forwarded-for");
        ipAddress = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
      }
      if (userAgent === undefined) {
        userAgent = h.get("user-agent") ?? undefined;
      }
    } catch {
      // Not in a request context — leave undefined
    }
  }

  return prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      before: params.before as Prisma.InputJsonValue | undefined,
      after: params.after as Prisma.InputJsonValue | undefined,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

export interface AuditLogFilter {
  entity?: string;
  entityId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

function buildWhere(f: AuditLogFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.entity) where.entity = f.entity;
  if (f.entityId) where.entityId = f.entityId;
  if (f.userId) where.userId = f.userId;
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: f.from } : {}),
      ...(f.to ? { lte: f.to } : {}),
    };
  }
  return where;
}

function requireAdmin(user: SessionUser) {
  if (!user.roles.includes("ADMIN")) throw new HttpError(403, "เฉพาะ Admin เท่านั้น");
}

export async function listAuditLogs(user: SessionUser, filter: AuditLogFilter = {}) {
  requireAdmin(user);
  return prisma.auditLog.findMany({
    where: buildWhere(filter),
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 50,
    skip: filter.offset ?? 0,
  });
}

export async function countAuditLogs(user: SessionUser, filter: AuditLogFilter = {}): Promise<number> {
  requireAdmin(user);
  return prisma.auditLog.count({ where: buildWhere(filter) });
}
