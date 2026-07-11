import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailAccountView } from "@/components/email-account/email-account-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Email account · Sendora" };

export default function EmailAccountPage() {
  // useSearchParams (OAuth return params) requires a Suspense boundary.
  return (
    <PageContainer size="content">
      <Suspense>
        <EmailAccountView />
      </Suspense>
    </PageContainer>
  );
}
