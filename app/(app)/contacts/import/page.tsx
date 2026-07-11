import type { Metadata } from "next";
import { ImportView } from "@/components/contacts/import-view";

export const metadata: Metadata = { title: "Import contacts · Sendora" };

export default function ImportContactsPage() {
  return <ImportView />;
}
