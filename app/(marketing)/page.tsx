import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteNav } from "@/components/marketing/site-nav";
import { ProductPreview } from "@/components/marketing/product-preview";
import { LinkButton } from "@/components/ui/link-button";
import { BrandMark } from "@/components/app-icons";
import styles from "./marketing.module.css";

const MAXW = 1160;
const BAND_PADY = "clamp(var(--spacing-12), 8vw, calc(var(--spacing-12) * 2))";

const TRUST = ["Sends from your Gmail", "Send-only access", "Ready in 5 minutes"];

const STEPS = [
  {
    title: "Import your recruiters",
    body: "Bring contacts from a CSV, an Excel file, or a quick paste. Sendora maps the columns and flags anything that needs a look.",
    fragment: <ImportFragment />,
  },
  {
    title: "Make it personal",
    body: "Pick a template with merge fields or write your own. Every name and company is filled in, and previewed, before a single email leaves.",
    fragment: <PersonalizeFragment />,
  },
  {
    title: "Send, and keep track",
    body: "Send one email or a batch of individual ones. See each outcome honestly, and get a heads-up before you re-contact someone.",
    fragment: <OutcomeFragment />,
  },
];

const GUARANTEES = [
  {
    title: "Your inbox, your reputation",
    body: "Emails send through your own Gmail, so replies come straight back to you, never to a faceless tool.",
  },
  {
    title: "Honest outcomes, failures included",
    body: "Every send is recorded per recipient. If one bounces, you see it. No quiet swallowing.",
  },
  {
    title: "A heads-up before you repeat",
    body: "Sendora warns you before you reach out to the same person twice. Bulk here means many individual emails.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const authed = user !== null;
  const primaryHref = authed ? "/dashboard" : "/sign-in";
  const primaryLabel = authed ? "Go to dashboard" : "Get started";

  return (
    <VStack gap={0} width="100%" className={styles.ink}>
      <SiteNav authed={authed} />

      {/* Hero — ink drench, the product email lit against it */}
      <Band className={styles.heroAura}>
        <Grid columns={{ minWidth: 420, max: 2 }} gap={10} align="center" className={styles.grid2}>
          <VStack gap={6} className={styles.rise}>
            <VStack gap={4}>
              <Heading level={1} type="display-2" textWrap="balance">
                Recruiter outreach that still sounds like you.
              </Heading>
              <Text size="lg" color="secondary" style={{ maxWidth: "50ch" }}>
                Sendora sends considered, one-to-one emails to recruiters from your own Gmail:
                organized, previewed, and honestly tracked. No mass blast. No spam energy. No
                stray <code style={{ opacity: 0.8 }}>{"{{name}}"}</code> in front of a hiring
                manager.
              </Text>
            </VStack>
            <HStack gap={4} align="center" wrap="wrap">
              <LinkButton href={primaryHref} label={primaryLabel} variant="primary" size="lg" />
              <Link href="#how" className={styles.quietLink}>
                <HStack gap={1.5} align="center">
                  <Text color="inherit" weight="medium">
                    See how it works
                  </Text>
                  <Icon icon="arrowDown" color="inherit" size="sm" />
                </HStack>
              </Link>
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

          <VStack className={styles.rise} style={{ animationDelay: "160ms" }}>
            <ProductPreview />
          </VStack>
        </Grid>
      </Band>

      {/* Point of view — one committed statement, no feature scaffolding */}
      <Band className={styles.litEdge}>
        <VStack gap={5} style={{ maxWidth: "min(100%, 46rem)" }}>
          <Heading level={2} type="display-2" textWrap="balance">
            You&apos;re not running a campaign. You&apos;re introducing yourself.
          </Heading>
          <Text size="lg" color="secondary" style={{ maxWidth: "48ch" }}>
            A job hunt is personal and it&apos;s stressful. The tool should lower that, one clear
            step at a time, and the truth about what went out.
          </Text>
        </VStack>
      </Band>

      {/* The flow — a real 3-step sequence, alternating rows, real UI fragments */}
      <Band id="how" className={styles.litEdge}>
        <VStack gap={10}>
          <VStack gap={3} style={{ maxWidth: "40ch" }}>
            <Heading level={2} textWrap="balance">
              From an empty account to a sent email in five minutes.
            </Heading>
            <Text size="lg" color="secondary">
              Three unhurried steps. Each one shows you exactly what happens next.
            </Text>
          </VStack>

          <VStack gap={10}>
            {STEPS.map((step, i) => (
              <StepRow key={step.title} n={i + 1} title={step.title} body={step.body} flip={i % 2 === 1}>
                {step.fragment}
              </StepRow>
            ))}
          </VStack>
        </VStack>
      </Band>

      {/* Sending is sacred — the differentiator gets the dominant moment */}
      <Band className={styles.litEdge}>
        <VStack gap={10}>
          <Grid columns={{ minWidth: 380, max: 2 }} gap={10} align="center" className={styles.grid2}>
            <VStack gap={4} style={{ maxWidth: "44ch" }}>
              <Heading level={2} textWrap="balance">
                Sending is sacred.
              </Heading>
              <Text size="lg" color="secondary">
                An email is irreversible and tied to your name. So Sendora shows you the real
                message, every merge field resolved, and won&apos;t let a literal token slip
                through to a recruiter.
              </Text>
            </VStack>
            <PreviewGateFragment />
          </Grid>

          <VStack gap={6}>
            <Divider variant="subtle" />
            <Grid columns={{ minWidth: 240, max: 3 }} gap={8}>
              {GUARANTEES.map((g) => (
                <HStack key={g.title} gap={3} align="start">
                  <span
                    style={{
                      color: "var(--color-icon-accent)",
                      display: "inline-flex",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <Icon icon="check" size="sm" color="inherit" />
                  </span>
                  <VStack gap={1}>
                    <Text weight="medium">{g.title}</Text>
                    <Text size="sm" color="secondary">
                      {g.body}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </Grid>
          </VStack>
        </VStack>
      </Band>

      {/* Closing CTA — ink, focused, one gold button */}
      <Band className={styles.litEdge}>
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
              · calm recruiter outreach
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

/* ---------- layout primitives ---------- */

function Band({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <VStack id={id} as="section" width="100%" className={className}>
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

function StepRow({
  n,
  title,
  body,
  flip,
  children,
}: {
  n: number;
  title: string;
  body: string;
  flip: boolean;
  children: ReactNode;
}) {
  const copy = (
    <VStack gap={3} align="start" style={{ maxWidth: "38ch" }}>
      <HStack gap={3} align="center">
        <span className={styles.stepIndex} style={{ fontSize: "var(--font-size-2xl)" }}>
          {String(n).padStart(2, "0")}
        </span>
        <Heading level={3}>{title}</Heading>
      </HStack>
      <Text color="secondary">{body}</Text>
    </VStack>
  );
  const panel = (
    <HStack width="100%" justify={flip ? "start" : "end"}>
      {children}
    </HStack>
  );

  return (
    <Grid
      columns={{ minWidth: 320, max: 2 }}
      gap={10}
      align="center"
      className={[styles.grid2, flip ? styles.flipDesktop : ""].filter(Boolean).join(" ")}
    >
      {copy}
      {panel}
    </Grid>
  );
}

/* ---------- lit product fragments (light-mode screens against the ink) ---------- */

function LitPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <Card padding={0} className={styles.litScreen} style={{ maxWidth: 420, width: "100%", ...style }}>
      {children}
    </Card>
  );
}

function ImportFragment() {
  const rows: [string, string, boolean][] = [
    ["Full name", "name", true],
    ["Company", "company", true],
    ["Email", "email", true],
    ["Phone", "skipped", false],
  ];
  return (
    <LitPanel>
      <VStack gap={0}>
        <HStack gap={2} align="center" padding={4}>
          <Text size="sm" weight="medium">
            recruiters.csv
          </Text>
          <Text size="sm" color="secondary">
            · 12 rows
          </Text>
        </HStack>
        <Divider variant="subtle" />
        <VStack gap={0} padding={4}>
          {rows.map(([col, mapped, ok]) => (
            <HStack key={col} justify="between" align="center" paddingBlock={2}>
              <Text size="sm" color="secondary">
                {col}
              </Text>
              <HStack gap={2} align="center">
                <Text size="sm" weight="medium" color={ok ? "primary" : "secondary"}>
                  {mapped}
                </Text>
                {ok ? (
                  <span style={{ color: "var(--color-icon-green)", display: "inline-flex" }}>
                    <Icon icon="check" size="sm" color="inherit" />
                  </span>
                ) : (
                  <span style={{ width: "var(--spacing-4)" }} aria-hidden />
                )}
              </HStack>
            </HStack>
          ))}
        </VStack>
      </VStack>
    </LitPanel>
  );
}

function PersonalizeFragment() {
  return (
    <LitPanel>
      <VStack gap={0}>
        <HStack gap={2} align="center" padding={4}>
          <Text size="sm" color="secondary">
            Template
          </Text>
          <Text size="sm" weight="medium">
            Intro · role fit
          </Text>
        </HStack>
        <Divider variant="subtle" />
        <VStack gap={3} padding={4}>
          <Text size="sm" color="secondary">
            Before
          </Text>
          <Text size="sm">
            Hi <TokenChip>{"{{name}}"}</TokenChip>, I saw <TokenChip>{"{{company}}"}</TokenChip> is
            hiring.
          </Text>
          <Divider variant="subtle" />
          <Text size="sm" color="secondary">
            Sent to Jordan
          </Text>
          <Text size="sm">Hi Jordan, I saw Northwind is hiring.</Text>
        </VStack>
      </VStack>
    </LitPanel>
  );
}

function OutcomeFragment() {
  const rows: [string, "success" | "error", string][] = [
    ["Jordan Lee", "success", "Sent"],
    ["Priya Nair", "success", "Sent"],
    ["Sam Cole", "error", "Bounced"],
  ];
  return (
    <LitPanel>
      <VStack gap={0}>
        <HStack justify="between" align="center" padding={4}>
          <Text size="sm" weight="medium">
            This batch
          </Text>
          <Text size="sm" color="secondary">
            2 sent · 1 failed
          </Text>
        </HStack>
        <Divider variant="subtle" />
        <VStack gap={0} padding={4}>
          {rows.map(([who, variant, label]) => (
            <HStack key={who} justify="between" align="center" paddingBlock={2}>
              <Text size="sm">{who}</Text>
              <StatusDot variant={variant} label={label} />
            </HStack>
          ))}
        </VStack>
      </VStack>
    </LitPanel>
  );
}

function PreviewGateFragment() {
  return (
    <LitPanel style={{ maxWidth: 460 }}>
      <VStack gap={0}>
        <HStack justify="between" align="center" padding={4}>
          <Text size="sm" weight="medium">
            Preview before send
          </Text>
          <Badge variant="success" label="0 unresolved" />
        </HStack>
        <Divider variant="subtle" />
        <VStack gap={3} padding={5}>
          <Text weight="semibold">Following up on the Senior Frontend role</Text>
          <Text size="sm" color="secondary">
            Hi Jordan, I noticed Northwind is hiring a Senior Frontend Engineer. The role looks
            like a genuine fit, and I&apos;d love to hear more.
          </Text>
          <HStack gap={2} wrap="wrap">
            <Badge variant="blue" label="name → Jordan" />
            <Badge variant="blue" label="company → Northwind" />
          </HStack>
        </VStack>
      </VStack>
    </LitPanel>
  );
}

function TokenChip({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        background: "var(--color-background-muted)",
        borderRadius: "var(--radius-sm)",
        padding: "0 var(--spacing-1)",
        color: "var(--color-text-secondary)",
      }}
    >
      {children}
    </code>
  );
}
