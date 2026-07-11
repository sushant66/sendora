import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { LinkButton } from "@/components/ui/link-button";
import type { CurrentUser } from "@/lib/auth/session";
import type { AccountStatus } from "@/lib/email/types";
import type { HistoryItem } from "@/lib/history/types";

type Props = {
  user: CurrentUser;
  account: AccountStatus;
  hasContacts: boolean;
  recent: HistoryItem[];
  hasSent: boolean;
};

type Step = {
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
};

export function DashboardView({ user, account, hasContacts, recent, hasSent }: Props) {
  const connected = account.connected;
  const expired = account.status === "expired";
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;

  const steps: Step[] = [
    {
      title: "Connect your Gmail",
      description: "Send from your own inbox so replies come back to you.",
      done: connected,
      href: "/settings/email-account",
      cta: "Connect Gmail",
    },
    {
      title: "Add your recruiters",
      description: "Import a CSV or paste a list — or add contacts by hand.",
      done: hasContacts,
      href: "/contacts/import",
      cta: "Import contacts",
    },
    {
      title: "Send your first email",
      description: "Pick a template, preview the real message, and send.",
      done: hasSent,
      href: "/compose",
      cta: "Compose email",
    },
  ];

  const allSetUp = steps.every((s) => s.done);
  const activeIndex = steps.findIndex((s) => !s.done);
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
                {doneCount} of {steps.length} done — three quick steps to your first sent email.
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
    </VStack>
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
            <Text weight="medium">{step.title}</Text>
            <Text type="supporting">{step.description}</Text>
          </VStack>
        </HStack>
        {step.done ? (
          <Text size="sm" color="secondary">
            Done
          </Text>
        ) : isActive ? (
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

const STATUS: Record<HistoryItem["status"], { variant: "success" | "error" | "neutral"; label: string }> = {
  sent: { variant: "success", label: "Sent" },
  failed: { variant: "error", label: "Failed" },
  pending: { variant: "neutral", label: "Pending" },
};

function RecentActivity({ recent }: { recent: HistoryItem[] }) {
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
