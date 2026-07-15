"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SideNav, SideNavHeading, SideNavSection, SideNavItem } from "@astryxdesign/core/SideNav";
import { Button } from "@astryxdesign/core/Button";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Popover } from "@astryxdesign/core/Popover";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { signOutAction } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/session";
import styles from "./app-sidebar.module.css";
import {
  BrandMark,
  ComposeIcon,
  ContactsIcon,
  HistoryIcon,
  HomeIcon,
  MailIcon,
  ProfileIcon,
  ResumesIcon,
  TemplatesIcon,
} from "./app-icons";

// The sidebar is the work. Contacts, Templates, and Resumes are the reusable
// inputs; History is the record. Compose is not listed here because the primary
// button above already leads to it. Identity, the email-account setting, and
// sign out live in the footer account menu, not the nav.
const OUTREACH = [
  { label: "Contacts", href: "/contacts", icon: ContactsIcon },
  { label: "Templates", href: "/templates", icon: TemplatesIcon },
  { label: "Resumes", href: "/resumes", icon: ResumesIcon },
  { label: "History", href: "/history", icon: HistoryIcon },
] as const;

export function AppSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
      footer={<AccountMenu user={user} />}
    >
      {/* Home stands on its own; the "Overview" heading over a single item earned
          nothing, so it is hidden but kept for screen-reader grouping. */}
      <SideNavSection title="Overview" isHeaderHidden>
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
    </SideNav>
  );
}

function AccountMenu({ user }: { user: CurrentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayName = user.name ?? "Your account";

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="above"
      alignment="start"
      label="Account menu"
      content={
        <VStack gap={1} className={styles.menu}>
          <Link href="/profile" className={styles.item} onClick={() => setIsOpen(false)}>
            <ProfileIcon className={styles.itemIcon} width={18} height={18} />
            <Text size="sm">Your profile</Text>
          </Link>
          <Link
            href="/settings/email-account"
            className={styles.item}
            onClick={() => setIsOpen(false)}
          >
            <MailIcon className={styles.itemIcon} width={18} height={18} />
            <Text size="sm">Email account</Text>
          </Link>

          <Divider variant="subtle" />

          <form action={signOutAction}>
            <button type="submit" className={styles.item}>
              <SignOutGlyph className={styles.itemIcon} />
              <Text size="sm">Sign out</Text>
            </button>
          </form>
        </VStack>
      }
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Account menu for ${displayName}`}
      >
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
        <ChevronGlyph className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
      </button>
    </Popover>
  );
}

function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

function SignOutGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8" />
      <path d="M16 15.5 19.5 12 16 8.5M9.5 12h10" />
    </svg>
  );
}
