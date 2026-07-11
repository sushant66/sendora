import type { Metadata } from "next";
import { ImportView } from "@/components/contacts/import-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Import contacts · Sendora" };

export default function ImportContactsPage() {
  return (
    <PageContainer size="content">
      <ImportView />
    </PageContainer>
  );
}
