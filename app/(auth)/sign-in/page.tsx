import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { signInWithGoogle } from "@/app/actions/auth";
import { BrandMark } from "@/components/app-icons";

const REASSURANCES = [
  "Sends from your own Gmail — replies land in your inbox",
  "Only asks permission to send, never to read your mail",
  "Warns you before you re-contact someone",
];

export default function SignInPage() {
  return (
    <VStack align="center" justify="center" minHeight="100dvh" padding={6}>
      <Card padding={0} maxWidth={860} width="100%" style={{ overflow: "hidden" }}>
        <Grid columns={{ minWidth: 300, max: 2 }} gap={0}>
          {/* Brand / value panel */}
          <VStack
            gap={6}
            padding={8}
            justify="between"
            style={{ background: "var(--color-background-muted)" }}
          >
            <HStack gap={2} align="center" style={{ color: "var(--color-icon-accent)" }}>
              <BrandMark width={24} height={24} />
              <Text size="lg" weight="semibold" color="primary">
                Sendora
              </Text>
            </HStack>
            <VStack gap={5}>
              <Heading level={2} textWrap="balance">
                Personal recruiter outreach, without the busywork.
              </Heading>
              <VStack gap={3}>
                {REASSURANCES.map((line) => (
                  <HStack key={line} gap={2} align="start">
                    <span style={{ color: "var(--color-icon-accent)", display: "inline-flex", flexShrink: 0 }}>
                      <Icon icon="check" color="inherit" size="sm" />
                    </span>
                    <Text color="secondary">{line}</Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          </VStack>

          {/* Sign-in action */}
          <VStack gap={5} padding={8} justify="center">
            <VStack gap={2}>
              <Heading level={1}>Sign in to Sendora</Heading>
              <Text color="secondary">
                Continue with Google to send outreach from your own inbox.
              </Text>
            </VStack>
            <form action={signInWithGoogle}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                label="Continue with Google"
                icon={<GoogleGlyph />}
                style={{ width: "100%" }}
              />
            </form>
            <Text type="supporting">
              By continuing you connect a Google account. You can disconnect it any time from
              your email-account settings.
            </Text>
          </VStack>
        </Grid>
      </Card>
    </VStack>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
