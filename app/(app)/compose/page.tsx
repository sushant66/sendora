import type { Metadata } from "next";
import { ComposeView } from "@/components/compose/compose-view";

export const metadata: Metadata = { title: "Compose · Sendora" };

export default function ComposePage() {
  return <ComposeView />;
}
