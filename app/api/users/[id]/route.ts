import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, HttpError } from "@/lib/auth/current-user";
import { fail, ok, readJson } from "@/lib/http/respond";
import { writeAudit } from "@/lib/services/audit";
import { notifyUserApprovalResult } from "@/lib/services/notification";
import { checkApproverRouteConflict } from "@/lib/services/approval-route";

const APPROVER_ROLES = ["DEPT_APPROVER", "PALLET_MANAGER", "ADMIN"] as const;

const RoleEnum = z.enum(["REQUESTER", "DEPT_APPROVER", "PALLET_MANAGER", "ADMIN", "VIEWER"]);

// Policy: one role per user (UI shows a single-select; server enforces it).
const Patch = z.object({
  fullName:     z.string().min(1).max(120).optional(),
  phone:        z.string().max(40).optional().nullable(),
  roles:        z.array(RoleEnum).length(1).optional(),
  status:       z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional(),
  departmentId: z.string().optional().nullable(),
  sectionId:    z.string().optional().nullable(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const data = Patch.parse(await readJson(req));
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "ไม่พบผู้ใช้");

    // Guard: admin cannot lock themselves out — status, role, and department of
    // self are locked. (Changing own dept to a non-warehouse dept would create a
    // role↔dept mismatch since ADMIN is expected to live in the warehouse dept.)
    if (admin.id === id) {
      if (data.status === "DISABLED") {
        throw new HttpError(400, "ไม่สามารถปิดใช้งานบัญชีตัวเองได้");
      }
      if (data.roles !== undefined && !data.roles.includes("ADMIN")) {
        throw new HttpError(400, "ไม่สามารถเปลี่ยนบทบาทของตัวเองออกจาก ADMIN ได้");
      }
      if (data.departmentId !== undefined && data.departmentId !== before.departmentId) {
        throw new HttpError(400, "ไม่สามารถเปลี่ยนแผนกของตัวเองได้");
      }
    }

    // Validate section belongs to the resulting department
    const resolvedDeptId =
      data.departmentId === undefined ? before.departmentId : data.departmentId;
    if (data.sectionId) {
      const section = await prisma.departmentSection.findUnique({
        where: { id: data.sectionId },
      });
      if (!section) throw new HttpError(400, "ไม่พบ section");
      if (section.departmentId !== resolvedDeptId) {
        throw new HttpError(400, "section ไม่อยู่ในแผนกที่กำหนด");
      }
    }
    // If dept changed and section not explicitly set, clear section to avoid orphan
    if (data.departmentId !== undefined && data.sectionId === undefined) {
      data.sectionId = null;
    }

    // Guard: prevent changes that would leave an approval step with 0 approvers
    const isCurrentApprover = before.roles.some((r) => APPROVER_ROLES.includes(r as typeof APPROVER_ROLES[number]));
    if (isCurrentApprover) {
      const willLoseApproverRole = data.roles !== undefined && !data.roles.some((r) => APPROVER_ROLES.includes(r as typeof APPROVER_ROLES[number]));
      const willChangeDept = data.departmentId !== undefined && data.departmentId !== before.departmentId;
      const willDisable = data.status === "DISABLED" && before.status !== "DISABLED";
      if (willLoseApproverRole || willChangeDept || willDisable) {
        const conflict = await checkApproverRouteConflict(id);
        if (conflict) throw new HttpError(400, conflict);
      }
    }

    const updated = await prisma.user.update({ where: { id }, data });
    await writeAudit({
      userId: admin.id,
      entity: "user",
      entityId: id,
      action: "update",
      before,
      after: updated,
    });

    if (before.status === "PENDING" && data.status === "ACTIVE") {
      notifyUserApprovalResult(id, true).catch((e: unknown) => console.error("[notify]", e));
    } else if (before.status === "PENDING" && data.status === "DISABLED") {
      notifyUserApprovalResult(id, false).catch((e: unknown) => console.error("[notify]", e));
    }

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}
