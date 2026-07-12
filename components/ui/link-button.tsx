"use client";

import type { CSSProperties, ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Spinner } from "@astryxdesign/core/Spinner";

/**
 * A Button that navigates via next/link. Lives in a client module so that
 * Server Components can render link-styled buttons without passing the Link
 * component (a function) across the RSC boundary.
 *
 * While a navigation triggered by this button is in flight, the leading icon is
 * swapped for a spinner (via useLinkStatus, which reads the parent Link's pending
 * state). That gives the button itself an immediate "working" signal, so a click
 * that takes a moment to resolve never looks ignored. The label stays put as the
 * accessible name.
 */
export function LinkButton({
  href,
  label,
  variant = "secondary",
  size = "md",
  icon,
  style,
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Button as={Link} href={href} label={label} variant={variant} size={size} style={style}>
      <LinkButtonContent label={label} icon={icon} />
    </Button>
  );
}

// Rendered inside the Link (Button as={Link}), so useLinkStatus resolves the
// pending state for this specific navigation.
function LinkButtonContent({ label, icon }: { label: string; icon?: ReactNode }) {
  const { pending } = useLinkStatus();
  const leading = pending ? <Spinner size="sm" shade="inherit" label={undefined} /> : icon;
  return (
    <HStack gap={2} align="center" justify="center" style={{ display: "inline-flex" }}>
      {leading}
      <span>{label}</span>
    </HStack>
  );
}
