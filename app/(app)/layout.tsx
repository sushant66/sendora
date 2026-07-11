import { redirect } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { getCurrentUser } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <AppShell sideNav={<AppSidebar />} contentPadding={6}>
      {children}
    </AppShell>
  );
}
