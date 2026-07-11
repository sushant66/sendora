"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SideNav, SideNavHeading, SideNavSection, SideNavItem } from "@astryxdesign/core/SideNav";

function AppMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5.25 12 12l9-6.75M3 5.25h18v13.5H3V5.25Z" />
    </svg>
  );
}

const NAV = [
  { label: "Contacts", href: "/contacts" },
  { label: "Templates", href: "/templates" },
  { label: "Compose", href: "/compose" },
  { label: "History", href: "/history" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <SideNav
      header={<SideNavHeading heading="Sendora" icon={<AppMark />} headingHref="/" as={Link} />}
    >
      <SideNavSection title="Outreach">
        {NAV.map((item) => (
          <SideNavItem
            key={item.href}
            as={Link}
            href={item.href}
            label={item.label}
            isSelected={isActive(item.href)}
          />
        ))}
      </SideNavSection>
      <SideNavSection title="Account">
        <SideNavItem
          as={Link}
          href="/settings/email-account"
          label="Email account"
          isSelected={isActive("/settings/email-account")}
        />
      </SideNavSection>
    </SideNav>
  );
}
