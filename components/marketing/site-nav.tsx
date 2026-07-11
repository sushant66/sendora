import Link from "next/link";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { BrandMark } from "@/components/app-icons";
import { LinkButton } from "@/components/ui/link-button";

export function SiteNav({ authed }: { authed: boolean }) {
  return (
    <VStack
      as="header"
      width="100%"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "color-mix(in srgb, var(--color-background-surface) 88%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <HStack
        width="100%"
        maxWidth={1160}
        justify="between"
        align="center"
        gap={4}
        paddingBlock={3}
        paddingInline={6}
        style={{ marginInline: "auto" }}
      >
        <Link href="/" style={{ textDecoration: "none" }} aria-label="Sendora home">
          <HStack gap={2} align="center">
            <span style={{ color: "var(--color-icon-accent)", display: "inline-flex" }}>
              <BrandMark width={22} height={22} />
            </span>
            <Text size="lg" weight="semibold" color="primary">
              Sendora
            </Text>
          </HStack>
        </Link>

        {authed ? (
          <LinkButton href="/dashboard" label="Go to dashboard" variant="primary" />
        ) : (
          <HStack gap={2} align="center">
            <LinkButton href="/sign-in" label="Sign in" variant="ghost" />
            <LinkButton href="/sign-in" label="Get started" variant="primary" />
          </HStack>
        )}
      </HStack>
    </VStack>
  );
}
