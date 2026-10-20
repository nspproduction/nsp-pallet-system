"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TrendPoint } from "@/lib/services/dashboard";

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
        ไม่มีข้อมูลในช่วงเวลาที่เลือก
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(v, name) => [
            typeof v === "number" ? v.toLocaleString("th-TH") : String(v),
            name === "issued" ? "เบิกออก" : "คืนเข้า",
          ]}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(value) => value === "issued" ? "เบิกออก" : "คืนเข้า"}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line type="monotone" dataKey="issued" stroke="#f97316" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="returned" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
