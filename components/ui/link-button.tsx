"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";

/**
 * A Button that navigates via next/link. Lives in a client module so that
 * Server Components can render link-styled buttons without passing the Link
 * component (a function) across the RSC boundary.
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
    <Button as={Link} href={href} label={label} variant={variant} size={size} icon={icon} style={style} />
  );
}
