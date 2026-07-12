import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile/service";
import { ProfileView } from "@/components/profile/profile-view";
import { PageContainer } from "@/components/ui/page-container";

/** Sender profile page (US1). The values here fill the "Your details" merge fields and set
 *  the authoritative in-app display name. Every field is optional and never blocks a send. */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const profile = await getProfile(user.id);

  return (
    <PageContainer size="content">
      <ProfileView initialProfile={profile} accountName={user.name} />
    </PageContainer>
  );
}
