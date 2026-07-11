import type { Metadata } from "next";
import { ContactsView } from "@/components/contacts/contacts-view";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = { title: "Contacts · Sendora" };

export default function ContactsPage() {
  return (
    <PageContainer size="wide">
      <ContactsView />
    </PageContainer>
  );
}
