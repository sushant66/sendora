import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";

/**
 * Constrains and centers authenticated app content within a comfortable width.
 * Without it, pages either strand a narrow column against empty space on wide
 * displays (dashboard) or stretch data tables edge-to-edge so short values sit in
 * over-wide columns (contacts, templates, history). One shared frame keeps every
 * surface aligned — density with air, per DESIGN.md.
 */
const MAX_CONTENT_WIDTH = 1080;

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <VStack
      align="stretch"
      style={{ width: "100%", maxWidth: MAX_CONTENT_WIDTH, marginInline: "auto" }}
    >
      {children}
    </VStack>
  );
}
