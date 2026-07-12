import type { Metadata } from "next";
import { ResumesView } from "@/components/resumes/resumes-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Resumes · Sendora" };

export default function ResumesPage() {
  return (
    <PageContainer size="wide">
      <ResumesView />
    </PageContainer>
  );
}
