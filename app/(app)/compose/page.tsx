import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { ComposeView } from "@/components/compose/compose-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Compose · Sendora" };

export default async function ComposePage() {
  const user = await getCurrentUser();

  return (
    <PageContainer size="content">
      {/* The account name is the {{my_name}} fallback, so the pre-send gate can judge missing
          values exactly as the send will resolve them (FR-001). */}
      <ComposeView senderName={user?.name ?? null} />
    </PageContainer>
  );
}
