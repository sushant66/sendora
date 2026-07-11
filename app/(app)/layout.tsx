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

  // Each page frames its own content width via PageContainer, sized to the
  // surface (a list reads narrow, a data table reads wide).
  return (
    <AppShell sideNav={<AppSidebar user={user} />} contentPadding={6}>
      {children}
    </AppShell>
  );
}
