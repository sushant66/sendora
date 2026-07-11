import type { Metadata } from "next";
import { Theme } from "@astryxdesign/core/theme";
import { LayerProvider } from "@astryxdesign/core/Layer";
// Our editable theme, compiled by `pnpm exec astryx theme build lib/theme/neutralTheme.ts`.
// Import the built artifact (server-safe), not the defineTheme source (client-only).
import { neutralTheme } from "@/lib/theme/neutral";
// Astryx base styles (required — components render unstyled without these).
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
// Theme tokens (our gold-accent neutral theme). After base, before our overrides.
import "@/lib/theme/neutral.css";
// Design-system overrides — must load after Astryx so they take precedence.
import "./globals.css";

export const metadata: Metadata = {
  title: "Sendora",
  description: "Cold email outreach for job seekers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Theme theme={neutralTheme} mode="system">
          {/* Provides the themed toast/overlay viewport. Without it, useToast() self-mounts a
              fallback viewport on document.body — outside the scoped Theme subtree — so toasts
              lose the theme's inverted-surface tokens and render with broken contrast. */}
          <LayerProvider>{children}</LayerProvider>
        </Theme>
      </body>
    </html>
  );
}
