import { requireUser } from "@/lib/auth/current-user";
import { listOperatingHours, listHolidays } from "@/lib/services/operating-hours";
import { PageHeader } from "@/app/_components/ui";
import { OperatingHoursClient } from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  const hours = await listOperatingHours();
  const holidays = await listHolidays();

  return (
    <div className="space-y-6">
      <PageHeader
        title="ช่วงเวลาทำรายการ"
        subtitle="กำหนดวัน-เวลาที่ผู้ใช้สามารถส่งคำขอปกติได้ — นอกเวลาต้องส่งเป็น 'คำขอด่วน'"
      />
      <OperatingHoursClient hours={hours} holidays={holidays} />
    </div>
  );
}
