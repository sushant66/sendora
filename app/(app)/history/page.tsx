import type { Metadata } from "next";
import { HistoryView } from "@/components/history/history-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "History · Sendora" };

export default function HistoryPage() {
  return (
    <PageContainer size="content">
      <HistoryView />
    </PageContainer>
  );
}
