import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth/session";
import type { User, UserRole } from "@prisma/client";

export type SessionUser = User;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

// Returns the session user regardless of status (ACTIVE / PENDING / DISABLED).
// Use for endpoints that need to serve PENDING/DISABLED users (registration page,
// status display). Callers must handle status explicitly.
export async function getSessionUserAnyStatus(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.uid } });
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "unauthenticated");
  return u;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new HttpError(403, "forbidden");
  return u;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}
