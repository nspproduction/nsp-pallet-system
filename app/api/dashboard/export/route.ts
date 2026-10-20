import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { fail } from "@/lib/http/respond";
import { exportDashboardExcel } from "@/lib/services/export";
import type { DashboardFilter } from "@/lib/services/dashboard";

export async function GET(req: NextRequest) {
  try {
    await requireUser();

    const sp = req.nextUrl.searchParams;
    const filter: DashboardFilter = {
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
      departmentId: sp.get("departmentId") ?? undefined,
      palletTypeId: sp.get("palletTypeId") ?? undefined,
    };

    const buf = await exportDashboardExcel(filter);
    const now = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="pallet-report-${now}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
