"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SideNav,
  SideNavHeading,
  SideNavSection,
  SideNavItem,
} from "@astryxdesign/core/SideNav";
import { Button } from "@astryxdesign/core/Button";
import { Avatar } from "@astryxdesign/core/Avatar";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { signOutAction } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/session";
import {
  BrandMark,
  ComposeIcon,
  ContactsIcon,
  HistoryIcon,
  HomeIcon,
  MailIcon,
  ResumesIcon,
  TemplatesIcon,
} from "./app-icons";

const OUTREACH = [
  { label: "Contacts", href: "/contacts", icon: ContactsIcon },
  { label: "Templates", href: "/templates", icon: TemplatesIcon },
  { label: "Resumes", href: "/resumes", icon: ResumesIcon },
  { label: "Compose", href: "/compose", icon: ComposeIcon },
  { label: "History", href: "/history", icon: HistoryIcon },
] as const;

export function AppSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <SideNav
      header={
        <SideNavHeading
          heading="Sendora"
          subheading="Recruiter outreach"
          icon={<BrandMark />}
          headingHref="/dashboard"
          as={Link}
        />
      }
      topContent={
        <Button
          as={Link}
          href="/compose"
          label="Compose email"
          variant="primary"
          icon={<ComposeIcon width={16} height={16} />}
          style={{ width: "100%" }}
        />
      }
      footer={<AccountFooter user={user} />}
    >
      <SideNavSection title="Overview">
        <SideNavItem
          as={Link}
          href="/dashboard"
          label="Home"
          icon={HomeIcon}
          isSelected={isActive("/dashboard")}
        />
      </SideNavSection>
      <SideNavSection title="Outreach">
        {OUTREACH.map((item) => (
          <SideNavItem
            key={item.href}
            as={Link}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isSelected={isActive(item.href)}
          />
        ))}
      </SideNavSection>
      <SideNavSection title="Account">
        <SideNavItem
          as={Link}
          href="/settings/email-account"
          label="Email account"
          icon={MailIcon}
          isSelected={isActive("/settings/email-account")}
        />
      </SideNavSection>
    </SideNav>
  );
}

function AccountFooter({ user }: { user: CurrentUser }) {
  const displayName = user.name ?? "Your account";
  return (
    <HStack gap={2} align="center" justify="between" style={{ width: "100%" }}>
      <HStack gap={2} align="center" style={{ minWidth: 0 }}>
        <Avatar name={user.name ?? user.email} src={user.image ?? undefined} size="small" />
        <VStack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" weight="medium" maxLines={1}>
            {displayName}
          </Text>
          <Text size="xsm" color="secondary" maxLines={1}>
            {user.email}
          </Text>
        </VStack>
      </HStack>
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          isIconOnly
          tooltip="Sign out"
          label="Sign out"
          icon={<SignOutGlyph />}
        />
      </form>
    </HStack>
  );
}

function SignOutGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8" />
      <path d="M16 15.5 19.5 12 16 8.5M9.5 12h10" />
    </svg>
  );
}
