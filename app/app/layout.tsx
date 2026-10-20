import { redirect } from "next/navigation";
import { getSessionUserAnyStatus } from "@/lib/auth/current-user";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserAnyStatus();
  if (!user) {
    redirect("/api/auth/logout-and-redirect");
  }
  if (user.status !== "ACTIVE") {
    redirect("/api/auth/logout-and-redirect");
  }
  if (user.roles.includes("ADMIN")) {
    redirect("/manage");
  }

  return (
    <div className="min-h-screen bg-surface" suppressHydrationWarning>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm">{children}</div>
    </div>
  );
}
