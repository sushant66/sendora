import { redirect } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { getCurrentUser } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app-sidebar";
import { PageContainer } from "@/components/ui/page-container";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <AppShell sideNav={<AppSidebar user={user} />} contentPadding={6}>
      <PageContainer>{children}</PageContainer>
    </AppShell>
  );
}
