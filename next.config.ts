import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Astryx uses StyleX; its Next plugin/preset is wired in during `npx astryx init`.
  // Keep server-only packages (googleapis) out of the client bundle:
  serverExternalPackages: ["googleapis"],
};

export default nextConfig;
