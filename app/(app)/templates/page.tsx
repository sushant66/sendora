import type { Metadata } from "next";
import { TemplatesView } from "@/components/templates/templates-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Templates · Sendora" };

export default function TemplatesPage() {
  return (
    <PageContainer size="wide">
      <TemplatesView />
    </PageContainer>
  );
}
