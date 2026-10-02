import { requireUser } from "@/lib/auth/current-user";
import { listAuditLogs } from "@/lib/services/audit";
import { PageHeader, Card, Table, EmptyState } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requireUser();
  const p = await searchParams;
  const logs = await listAuditLogs({ entity: p.entity, limit: 200 });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" subtitle={`ประวัติทุกการเปลี่ยนแปลง · ${logs.length} รายการล่าสุด`} />
      {logs.length === 0 ? (
        <Card><EmptyState title="ไม่มีข้อมูล" /></Card>
      ) : (
        <Card>
          <Table head={["เวลา", "ผู้ใช้", "Entity", "Action", "Entity ID"]}>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-xs text-slate-500">{l.createdAt.toLocaleString("th-TH")}</td>
                <td className="px-4 py-3 text-slate-800">{l.user?.fullName ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{l.entity}</td>
                <td className="px-4 py-3 text-slate-700">{l.action}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{l.entityId}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
