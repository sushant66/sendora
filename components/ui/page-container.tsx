import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";

/**
 * Frames authenticated app content in a column that is CENTERED within the
 * content section (everything to the right of the sidebar), with balanced
 * gutters on both sides, the way Linear centers its content. The width is
 * generous so the column reads as a substantial centered block rather than a
 * narrow strip floating in a wide section. A slightly wider measure is allowed
 * for real data tables:
 *
 *  - content  the shared measure for lists, guidance, forms, and reading
 *  - wide     multi-column data tables (contacts, templates)
 */
const WIDTHS = {
  content: 1040,
  wide: 1280,
} as const;

export type PageWidth = keyof typeof WIDTHS;

export function PageContainer({
  children,
  size = "content",
}: {
  children: ReactNode;
  size?: PageWidth;
}) {
  return (
    <VStack
      align="stretch"
      style={{
        width: "100%",
        maxWidth: WIDTHS[size],
        marginInline: "auto",
        paddingBlockStart: "var(--spacing-8)",
      }}
    >
      {children}
    </VStack>
  );
}
