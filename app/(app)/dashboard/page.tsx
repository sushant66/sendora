import { redirect } from "next/navigation";
import { getCurrentUser, resolveDisplayName } from "@/lib/auth/session";
import { getAccountStatus } from "@/lib/email/account-service";
import { listContacts } from "@/lib/contacts/service";
import { hasSentAny, listRecentRecords } from "@/lib/history/service";
import { getProfile } from "@/lib/profile/service";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageContainer } from "@/components/ui/page-container";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Fetch the real state that drives the dashboard's guidance — never fabricated.
  const [account, contacts, recent, hasSent, profile] = await Promise.all([
    getAccountStatus(user.id),
    listContacts(user.id),
    listRecentRecords(user.id, 5),
    hasSentAny(user.id),
    getProfile(user.id),
  ]);

  // The profile display name is authoritative for the greeting (FR-001).
  const greetingUser = { ...user, name: resolveDisplayName(profile.displayName, user.name) };

  return (
    <PageContainer size="content">
      <DashboardView
        user={greetingUser}
        account={account}
        hasContacts={contacts.items.length > 0}
        recent={recent}
        hasSent={hasSent}
        hasProfile={Boolean(profile.displayName || profile.title || profile.pitch)}
      />
    </PageContainer>
  );
}
