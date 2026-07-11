import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountStatus } from "@/lib/email/account-service";
import { listContacts } from "@/lib/contacts/service";
import { hasSentAny, listRecentRecords } from "@/lib/history/service";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageContainer } from "@/components/ui/page-container";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Fetch the real state that drives the dashboard's guidance — never fabricated.
  const [account, contacts, recent, hasSent] = await Promise.all([
    getAccountStatus(user.id),
    listContacts(user.id),
    listRecentRecords(user.id, 5),
    hasSentAny(user.id),
  ]);

  return (
    <PageContainer size="content">
      <DashboardView
        user={user}
        account={account}
        hasContacts={contacts.items.length > 0}
        recent={recent}
        hasSent={hasSent}
      />
    </PageContainer>
  );
}
