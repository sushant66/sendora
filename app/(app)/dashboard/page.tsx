import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountStatus } from "@/lib/email/account-service";
import { listContacts } from "@/lib/contacts/service";
import { listHistory } from "@/lib/history/service";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Fetch the real state that drives the dashboard's guidance — never fabricated.
  const [account, contacts, history] = await Promise.all([
    getAccountStatus(user.id),
    listContacts(user.id),
    listHistory(user.id),
  ]);

  return (
    <DashboardView
      user={user}
      account={account}
      hasContacts={contacts.items.length > 0}
      recent={history.items.slice(0, 5)}
      hasSent={history.items.some((i) => i.status === "sent")}
    />
  );
}
