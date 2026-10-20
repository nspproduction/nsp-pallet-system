import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AdminShell } from "./_shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/logout-and-redirect");
  }
  if (!user.roles.includes("ADMIN")) redirect("/app");
  return <AdminShell>{children}</AdminShell>;
}
