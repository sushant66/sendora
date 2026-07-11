import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Divider } from "@astryxdesign/core/Divider";
import { Avatar } from "@astryxdesign/core/Avatar";
import styles from "@/app/(marketing)/marketing.module.css";

/**
 * A faithful mockup of Sendora's send preview, used as the landing hero's
 * imagery. It mirrors the real product: a resolved (no literal {{tokens}})
 * one-to-one email, sent from the user's own inbox, with an honest outcome.
 *
 * On the ink landing it renders as a "lit screen" (see `.litScreen`): a real,
 * light-mode email glowing against the dark surface, so the product itself is
 * the hero image. The "Sent" badge lands last — an echo of how the app reports
 * each per-recipient result as it settles.
 */
export function ProductPreview() {
  return (
    <Card padding={0} width="100%" className={styles.litScreen}>
      <VStack gap={0}>
        <HStack justify="between" align="center" gap={3} padding={4}>
          <HStack gap={2} align="center" style={{ minWidth: 0 }}>
            <Text size="sm" color="secondary">
              To
            </Text>
            <Text size="sm" weight="medium" maxLines={1}>
              jordan.lee@northwind.co
            </Text>
          </HStack>
          <span className={styles.sentLand} style={{ display: "inline-flex" }}>
            <Badge variant="success" label="Sent" />
          </span>
        </HStack>
        <Divider variant="subtle" />

        <VStack gap={4} padding={5}>
          <Text weight="semibold">Following up on the Senior Frontend role</Text>
          <VStack gap={3}>
            <Text color="secondary">Hi Jordan,</Text>
            <Text color="secondary">
              I noticed Northwind is hiring a Senior Frontend Engineer. I&apos;ve spent the last
              five years building design-system-driven React apps, and the role looks like a
              genuine fit, and I&apos;d love to hear more.
            </Text>
            <Text color="secondary">Would a short call next week work?</Text>
          </VStack>
          <HStack gap={2} align="center" wrap="wrap">
            <Badge variant="blue" label="name → Jordan" />
            <Badge variant="blue" label="company → Northwind" />
            <Badge variant="blue" label="role → Senior Frontend Engineer" />
          </HStack>
        </VStack>
        <Divider variant="subtle" />

        <HStack
          justify="between"
          align="center"
          gap={3}
          padding={4}
          style={{ background: "var(--color-background-muted)" }}
        >
          <HStack gap={2} align="center" style={{ minWidth: 0 }}>
            <Avatar name="Alex Rivera" size="xsmall" />
            <Text size="sm" color="secondary" maxLines={1}>
              from alex@gmail.com
            </Text>
          </HStack>
          <HStack gap={2} align="center">
            <StatusDot variant="success" label="Delivered" />
            <Text size="sm" color="secondary">
              1 of 12 personalized
            </Text>
          </HStack>
        </HStack>
      </VStack>
    </Card>
  );
}
