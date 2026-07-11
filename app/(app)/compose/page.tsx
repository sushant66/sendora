import type { Metadata } from "next";
import { ComposeView } from "@/components/compose/compose-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Compose · Sendora" };

export default function ComposePage() {
  return (
    <PageContainer size="content">
      <ComposeView />
    </PageContainer>
  );
}
