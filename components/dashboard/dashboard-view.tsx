import type { ReactElement, SVGProps } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { LinkButton } from "@/components/ui/link-button";
import { ComposeIcon, ContactsIcon, TemplatesIcon, HistoryIcon } from "@/components/app-icons";
import type { CurrentUser } from "@/lib/auth/session";
import type { AccountStatus } from "@/lib/email/types";
import type { HistoryRecord } from "@/lib/history/types";

type Props = {
  user: CurrentUser;
  account: AccountStatus;
  hasContacts: boolean;
  recent: HistoryRecord[];
  hasSent: boolean;
  /** Whether the sender profile has any content yet (US1/US5 onboarding step). */
  hasProfile?: boolean;
};

type Step = {
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
  /** Optional steps never block "all set up"; they guide but aren't required (US5). */
  optional?: boolean;
};

export function DashboardView({ user, account, hasContacts, recent, hasSent, hasProfile = false }: Props) {
  const expired = account.status === "expired";
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;

  // Order the setup so a job seeker sees the value (contacts + a real rendered template, then
  // their own details) before the Gmail prompt, which is requested at first send (US5, SC-007).
  const steps: Step[] = [
    {
      title: "Add your recruiters",
      description: "Import a CSV, paste a list, or add contacts by hand.",
      done: hasContacts,
      href: "/contacts/import",
      cta: "Import contacts",
    },
    {
      title: "Personalize a template",
      description: "Preview a real, rendered email and add your details so they fill your outreach.",
      done: hasProfile,
      href: "/profile",
      cta: "Set up your profile",
      optional: true,
    },
    {
      title: "Send your first email",
      description: "Pick a template, preview the real message, and send. You'll connect Gmail here.",
      done: hasSent,
      href: "/compose",
      cta: "Compose email",
    },
  ];

  // Optional steps guide but never gate "all set up" (US5): only required steps must be done.
  const allSetUp = steps.every((s) => s.done || s.optional);
  const activeIndex = steps.findIndex((s) => !s.done && !s.optional);
  const next =
    allSetUp || activeIndex < 0
      ? { href: "/compose", cta: "Compose email" }
      : steps[activeIndex]!;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <VStack gap={6}>
      {/* Greeting + primary next step */}
      <HStack justify="between" align="start" gap={4}>
        <VStack gap={2}>
          <VStack gap={1}>
            <Heading level={1}>
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </Heading>
            <Text color="secondary">
              {allSetUp
                ? "You're all set. Compose your next round of outreach whenever you're ready."
                : "A calm way to run recruiter outreach from your own inbox. Let's get you set up."}
            </Text>
          </VStack>
          <ConnectionPill account={account} />
        </VStack>
        <LinkButton href={next.href} label={next.cta} variant="primary" />
      </HStack>

      {expired && (
        <Banner
          status="warning"
          container="card"
          title="Reconnect your Gmail"
          description="Your Gmail authorization expired. Reconnect to keep sending."
          endContent={
            <LinkButton href="/settings/email-account" label="Reconnect" variant="primary" />
          }
        />
      )}

      {!allSetUp && (
        <Card padding={5}>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Get set up</Heading>
              <Text type="supporting">
                {doneCount} of {steps.length} done. A few steps to your first sent email.
              </Text>
            </VStack>
            <VStack gap={0}>
              {steps.map((step, i) => (
                <StepRow
                  key={step.title}
                  step={step}
                  index={i}
                  isActive={i === activeIndex}
                  showDivider={i < steps.length - 1}
                />
              ))}
            </VStack>
          </VStack>
        </Card>
      )}

      <RecentActivity recent={recent} />

      {allSetUp && <QuickActions />}
    </VStack>
  );
}

const QUICK_ACTIONS = [
  {
    href: "/compose",
    glyph: ComposeIcon,
    title: "Compose an email",
    description: "Send personalized outreach to your recruiters.",
  },
  {
    href: "/contacts",
    glyph: ContactsIcon,
    title: "Contacts",
    description: "Add or update the recruiters you reach out to.",
  },
  {
    href: "/templates",
    glyph: TemplatesIcon,
    title: "Templates",
    description: "Edit the reusable emails you send.",
  },
  {
    href: "/history",
    glyph: HistoryIcon,
    title: "History",
    description: "See every email you've sent and its outcome.",
  },
] as const;

// The "all set" home would otherwise collapse to a header and one activity row,
// leaving the page stranded at the top. A calm launcher of real destinations
// gives it body and a next move, without inventing vanity metrics.
function QuickActions() {
  return (
    <VStack gap={3}>
      <Heading level={2}>Quick actions</Heading>
      <List hasDividers>
        {QUICK_ACTIONS.map((a) => (
          <Item
            key={a.href}
            href={a.href}
            startContent={<ActionIcon glyph={a.glyph} />}
            label={a.title}
            description={a.description}
            descriptionLines={1}
            endContent={<Icon icon="chevronRight" size="sm" color="secondary" />}
          />
        ))}
      </List>
    </VStack>
  );
}

function ActionIcon({ glyph: Glyph }: { glyph: (props: SVGProps<SVGSVGElement>) => ReactElement }) {
  return (
    <HStack
      align="center"
      justify="center"
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: "var(--radius-element)",
        background: "var(--color-background-muted)",
        color: "var(--color-text-secondary)",
      }}
    >
      <Glyph width={16} height={16} />
    </HStack>
  );
}

function ConnectionPill({ account }: { account: AccountStatus }) {
  if (account.connected) {
    return (
      <HStack gap={2} align="center">
        <StatusDot variant="success" label="Gmail connected" />
        <Text size="sm" color="secondary">
          Sending from {account.emailAddress}
        </Text>
      </HStack>
    );
  }
  if (account.status === "expired") {
    return (
      <HStack gap={2} align="center">
        <StatusDot variant="warning" label="Gmail authorization expired" />
        <Text size="sm" color="secondary">
          Gmail needs reconnecting
        </Text>
      </HStack>
    );
  }
  return (
    <HStack gap={2} align="center">
      <StatusDot variant="neutral" label="No email account connected" />
      <Text size="sm" color="secondary">
        No email account connected yet
      </Text>
    </HStack>
  );
}

function StepRow({
  step,
  index,
  isActive,
  showDivider,
}: {
  step: Step;
  index: number;
  isActive: boolean;
  showDivider: boolean;
}) {
  return (
    <VStack gap={0}>
      <HStack gap={3} align="center" justify="between" paddingBlock={3}>
        <HStack gap={3} align="center" style={{ minWidth: 0 }}>
          <StepMarker done={step.done} active={isActive} n={index + 1} />
          <VStack gap={0} style={{ minWidth: 0 }}>
            <HStack gap={2} align="center">
              <Text weight="medium">{step.title}</Text>
              {step.optional && (
                <Text size="xsm" color="secondary">
                  Optional
                </Text>
              )}
            </HStack>
            <Text type="supporting">{step.description}</Text>
          </VStack>
        </HStack>
        {step.done ? (
          <Text size="sm" color="secondary">
            Done
          </Text>
        ) : isActive || step.optional ? (
          <LinkButton href={step.href} label={step.cta} variant="secondary" size="sm" />
        ) : null}
      </HStack>
      {showDivider && <Divider variant="subtle" />}
    </VStack>
  );
}

function StepMarker({ done, active, n }: { done: boolean; active: boolean; n: number }) {
  const bg = done
    ? "var(--color-accent)"
    : active
      ? "var(--color-accent-muted)"
      : "var(--color-background-muted)";
  const fg = done
    ? "var(--color-on-accent)"
    : active
      ? "var(--color-text-accent)"
      : "var(--color-text-secondary)";
  return (
    <HStack
      align="center"
      justify="center"
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: "var(--radius-full)",
        background: bg,
        color: fg,
      }}
    >
      {done ? (
        <Icon icon="check" color="inherit" size="sm" />
      ) : (
        <Text size="sm" weight="medium" color="inherit">
          {n}
        </Text>
      )}
    </HStack>
  );
}

const STATUS: Record<HistoryRecord["status"], { variant: "success" | "error" | "neutral"; label: string }> = {
  sent: { variant: "success", label: "Sent" },
  failed: { variant: "error", label: "Failed" },
  pending: { variant: "neutral", label: "Pending" },
};

function RecentActivity({ recent }: { recent: HistoryRecord[] }) {
  return (
    <VStack gap={3}>
      <HStack justify="between" align="center">
        <Heading level={2}>Recent activity</Heading>
        {recent.length > 0 && (
          <LinkButton href="/history" label="View all" variant="ghost" size="sm" />
        )}
      </HStack>
      {recent.length === 0 ? (
        <Card padding={5} variant="muted">
          <Text color="secondary">
            No emails sent yet. When you send outreach, each message shows up here with its
            recipient, subject, and outcome.
          </Text>
        </Card>
      ) : (
        <VStack gap={0}>
          {recent.map((item, i) => {
            const s = STATUS[item.status];
            return (
              <VStack key={item.id} gap={0}>
                <HStack gap={3} align="center" justify="between" paddingBlock={3}>
                  <HStack gap={3} align="center" style={{ minWidth: 0 }}>
                    <StatusDot variant={s.variant} label={s.label} tooltip={item.failureReason ?? undefined} />
                    <VStack gap={0} style={{ minWidth: 0 }}>
                      <Text weight="medium" maxLines={1}>
                        {item.recipientEmail}
                      </Text>
                      <Text type="supporting" maxLines={1}>
                        {item.subject}
                      </Text>
                    </VStack>
                  </HStack>
                  <Text size="sm" color="secondary" style={{ flexShrink: 0 }}>
                    {formatWhen(item.sentAt ?? item.createdAt)}
                  </Text>
                </HStack>
                {i < recent.length - 1 && <Divider variant="subtle" />}
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
