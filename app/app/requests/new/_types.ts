export interface PalletType {
  id: string;
  code: string;
  name: string;
}

export interface Section {
  id: string;
  name: string;
}

export interface MeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    fullName: string;
    roles: string[];
    department?: { id: string; name: string; isWarehouse: boolean } | null;
    section?: Section | null;
  };
}

export type Mode = "ISSUE_OUT" | "RETURN_IN";
export type Condition = "GOOD" | "PENDING_REPAIR" | "DAMAGED";

export interface Item {
  palletTypeId: string;
  quantity: number;
}

export interface BalanceRow {
  palletTypeId: string;
  condition: string;
  quantity: number;
  department: { isWarehouse: boolean } | null;
}

export interface OperatingStatus {
  isOpen: boolean;
  nextOpenAt?: string;
}

export const MODE_LABEL: Record<Mode, string> = {
  ISSUE_OUT: "เบิกออก",
  RETURN_IN: "คืนเข้า"
};

export const MODE_ACTIVE: Record<Mode, string> = {
  ISSUE_OUT: "bg-white text-rose-700 shadow-sm",
  RETURN_IN: "bg-white text-emerald-700 shadow-sm",
};

export const CONDITIONS: { value: Condition; label: string; tone: string }[] = [
  { value: "GOOD", label: "ดี", tone: "emerald" },
  { value: "PENDING_REPAIR", label: "ส่งซ่อม", tone: "amber" },
  { value: "DAMAGED", label: "เสีย", tone: "rose" }
];

export type Palette = {
  border: string;       // card border
  labelText: string;    // section accent label
  link: string;         // "+ เพิ่ม..." links
  submitBtn: string;    // bottom submit button
  itemRowBg: string;    // each pallet row background
  focusBorder: string;  // input focus ring
};

export const PALETTE: Record<Mode, Palette> = {
  ISSUE_OUT: {
    border:      "border-rose-200",
    labelText:   "text-rose-700",
    link:        "text-rose-600",
    submitBtn:   "bg-rose-600 shadow-rose-600/30 hover:bg-rose-700",
    itemRowBg:   "bg-rose-50/40",
    focusBorder: "focus:border-rose-400",
  },
  RETURN_IN: {
    border:      "border-emerald-200",
    labelText:   "text-emerald-700",
    link:        "text-emerald-600",
    submitBtn:   "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700",
    itemRowBg:   "bg-emerald-50/40",
    focusBorder: "focus:border-emerald-400",
  },
};

export const INPUT_BASE = "w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500";
