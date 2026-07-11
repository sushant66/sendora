import type { Metadata } from "next";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
// Astryx base styles (required — components render unstyled without these).
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

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
          {children}
        </Theme>
      </body>
    </html>
  );
}
