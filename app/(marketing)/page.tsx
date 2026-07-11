import type { ReactNode } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteNav } from "@/components/marketing/site-nav";
import { ProductPreview } from "@/components/marketing/product-preview";
import { LinkButton } from "@/components/ui/link-button";
import {
  BrandMark,
  ComposeIcon,
  ContactsIcon,
  HistoryIcon,
  MailIcon,
} from "@/components/app-icons";

const MAXW = 1160;
const BAND_PADY = "clamp(var(--spacing-12), 8vw, calc(var(--spacing-12) * 2))";

const TRUST = [
  "Sends from your Gmail",
  "Send-only access",
  "Ready in 5 minutes",
];

const STEPS = [
  {
    title: "Import your recruiters",
    body: "Bring contacts from a CSV, an Excel file, or a quick paste. Sendora maps the columns and flags anything that needs a look.",
  },
  {
    title: "Make it personal",
    body: "Pick a template with merge fields or write your own. Every name and company is filled in and previewed before a single email leaves.",
  },
  {
    title: "Send, and keep track",
    body: "Send one email or a batch of individual ones. See each outcome honestly — and get a heads-up before you re-contact someone.",
  },
];

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <MailIcon width={22} height={22} />,
    title: "Your inbox, your reputation",
    body: "Emails send through your own Gmail, so replies come straight back to you — never to a shared, faceless tool.",
  },
  {
    icon: <ComposeIcon width={22} height={22} />,
    title: "A truthful preview, every time",
    body: "You see the real message with every merge field resolved before anything sends. No stray {{name}} in front of a recruiter.",
  },
  {
    icon: <HistoryIcon width={22} height={22} />,
    title: "Honest outcomes",
    body: "Every send is recorded per recipient — sent or failed — so you always know exactly what went out and to whom.",
  },
  {
    icon: <ContactsIcon width={22} height={22} />,
    title: "Personal, never spammy",
    body: "Bulk here means many individual emails — and Sendora warns you before you reach out to the same person twice.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const authed = user !== null;
  const primaryHref = authed ? "/dashboard" : "/sign-in";
  const primaryLabel = authed ? "Go to dashboard" : "Get started";

  return (
    <VStack gap={0} width="100%" style={{ background: "var(--color-background-body)" }}>
      <SiteNav authed={authed} />

      {/* Hero */}
      <Band>
        <Grid columns={{ minWidth: 380, max: 2 }} gap={10} align="center">
          <VStack gap={6}>
            <VStack gap={4}>
              <Heading level={1} type="display-2" textWrap="balance">
                Personal recruiter outreach that stays personal.
              </Heading>
              <Text size="lg" color="secondary" style={{ maxWidth: "52ch" }}>
                Sendora helps you send considered, one-to-one emails to recruiters from your own
                Gmail — organized, previewed, and honestly tracked. No mass-blast, no spam energy,
                no stress.
              </Text>
            </VStack>
            <HStack gap={3} align="center" wrap="wrap">
              <LinkButton href={primaryHref} label={primaryLabel} variant="primary" size="lg" />
              <LinkButton href="#how" label="See how it works" variant="secondary" size="lg" />
            </HStack>
            <HStack gap={5} align="center" wrap="wrap">
              {TRUST.map((t) => (
                <HStack key={t} gap={1.5} align="center">
                  <span style={{ color: "var(--color-icon-accent)", display: "inline-flex" }}>
                    <Icon icon="check" color="inherit" size="sm" />
                  </span>
                  <Text size="sm" color="secondary">
                    {t}
                  </Text>
                </HStack>
              ))}
            </HStack>
          </VStack>

          <ProductPreview />
        </Grid>
      </Band>

      {/* How it works */}
      <Band id="how" background="var(--color-background-surface)" withTopBorder>
        <VStack gap={10}>
          <VStack gap={3} style={{ maxWidth: "44ch" }}>
            <Heading level={2} textWrap="balance">
              From an empty account to a sent email in five minutes.
            </Heading>
            <Text size="lg" color="secondary">
              Three unhurried steps. Each one shows you exactly what happens next.
            </Text>
          </VStack>
          <Grid columns={{ minWidth: 260, max: 3 }} gap={8}>
            {STEPS.map((step, i) => (
              <VStack key={step.title} gap={3} align="start">
                <StepNum n={i + 1} />
                <Heading level={3}>{step.title}</Heading>
                <Text color="secondary">{step.body}</Text>
              </VStack>
            ))}
          </Grid>
        </VStack>
      </Band>

      {/* Why / trust */}
      <Band withTopBorder>
        <VStack gap={10}>
          <VStack gap={3} style={{ maxWidth: "44ch" }}>
            <Heading level={2} textWrap="balance">
              Outreach you can stand behind.
            </Heading>
            <Text size="lg" color="secondary">
              Sending an email is irreversible and tied to your name. Sendora is built around that.
            </Text>
          </VStack>
          <Grid columns={{ minWidth: 280, max: 2 }} gap={8}>
            {FEATURES.map((f) => (
              <HStack key={f.title} gap={3} align="start">
                <span style={{ color: "var(--color-icon-accent)", display: "inline-flex", flexShrink: 0 }}>
                  {f.icon}
                </span>
                <VStack gap={1}>
                  <Heading level={3}>{f.title}</Heading>
                  <Text color="secondary">{f.body}</Text>
                </VStack>
              </HStack>
            ))}
          </Grid>
        </VStack>
      </Band>

      {/* Closing CTA */}
      <Band withTopBorder>
        <Card variant="blue" padding={8}>
          <VStack gap={5} align="center" style={{ textAlign: "center" }}>
            <VStack gap={3} align="center" maxWidth={560}>
              <Heading level={2} justify="center" textWrap="balance">
                Send your next recruiter email with confidence.
              </Heading>
              <Text size="lg" color="secondary" justify="center">
                Connect your Gmail, bring your list, and get to a personal, sent email today.
              </Text>
            </VStack>
            <LinkButton href={primaryHref} label={primaryLabel} variant="primary" size="lg" />
          </VStack>
        </Card>
      </Band>

      {/* Footer */}
      <VStack
        as="footer"
        width="100%"
        style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-background-surface)" }}
      >
        <HStack
          width="100%"
          maxWidth={MAXW}
          justify="between"
          align="center"
          gap={4}
          wrap="wrap"
          paddingBlock={6}
          paddingInline={6}
          style={{ marginInline: "auto" }}
        >
          <HStack gap={2} align="center">
            <span style={{ color: "var(--color-icon-accent)", display: "inline-flex" }}>
              <BrandMark width={20} height={20} />
            </span>
            <Text weight="medium">Sendora</Text>
            <Text size="sm" color="secondary">
              — calm recruiter outreach
            </Text>
          </HStack>
          <Text size="sm" color="secondary">
            Personal outreach from your own inbox.
          </Text>
        </HStack>
      </VStack>
    </VStack>
  );
}

function Band({
  children,
  id,
  background,
  withTopBorder,
}: {
  children: ReactNode;
  id?: string;
  background?: string;
  withTopBorder?: boolean;
}) {
  return (
    <VStack
      id={id}
      as="section"
      width="100%"
      style={{
        background,
        borderTop: withTopBorder ? "1px solid var(--color-border)" : undefined,
      }}
    >
      <VStack
        width="100%"
        maxWidth={MAXW}
        paddingInline={6}
        style={{ marginInline: "auto", paddingBlock: BAND_PADY }}
      >
        {children}
      </VStack>
    </VStack>
  );
}

function StepNum({ n }: { n: number }) {
  return (
    <HStack
      align="center"
      justify="center"
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: "var(--radius-full)",
        background: "var(--color-accent)",
        color: "var(--color-on-accent)",
      }}
    >
      <Text size="lg" weight="semibold" color="inherit">
        {n}
      </Text>
    </HStack>
  );
}
