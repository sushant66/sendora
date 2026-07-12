import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { PageContainer } from "@/components/ui/page-container";

/**
 * Instant content-region skeleton for the dashboard. The dashboard fetches account,
 * contacts, recent history, and send status server-side, so without this the App Router
 * would hold the previous page on screen until all of that resolves (the "click, then
 * nothing for a couple seconds" symptom). This Suspense fallback swaps in the moment the
 * user navigates, shaped to the real layout so content lands without a jump. The AppShell
 * and sidebar stay mounted; only this region shows the placeholder.
 */
export default function DashboardLoading() {
  return (
    <PageContainer size="content">
      <VStack gap={6}>
        {/* Greeting + connection pill on the left, primary action on the right */}
        <HStack justify="between" align="start" gap={4}>
          <VStack gap={2}>
            <Skeleton width={240} height={28} radius={2} index={0} />
            <Skeleton width={420} height={16} radius={2} index={1} />
            <HStack gap={2} align="center" style={{ paddingBlockStart: "var(--spacing-1)" }}>
              <Skeleton width={10} height={10} radius="rounded" index={2} />
              <Skeleton width={200} height={14} radius={2} index={3} />
            </HStack>
          </VStack>
          <Skeleton width={128} height={40} radius={2} index={4} />
        </HStack>

        {/* Get-set-up card: heading + three step rows */}
        <Card padding={5}>
          <VStack gap={4}>
            <VStack gap={1}>
              <Skeleton width={120} height={22} radius={2} index={5} />
              <Skeleton width={300} height={14} radius={2} index={6} />
            </VStack>
            <VStack gap={0}>
              {[0, 1, 2].map((i) => (
                <VStack key={i} gap={0}>
                  <HStack gap={3} align="center" justify="between" paddingBlock={3}>
                    <HStack gap={3} align="center" style={{ minWidth: 0 }}>
                      <Skeleton width={28} height={28} radius="rounded" index={7 + i * 2} />
                      <VStack gap={1}>
                        <Skeleton width={160} height={15} radius={2} index={8 + i * 2} />
                        <Skeleton width={260} height={13} radius={2} index={8 + i * 2} />
                      </VStack>
                    </HStack>
                  </HStack>
                  {i < 2 && <Divider variant="subtle" />}
                </VStack>
              ))}
            </VStack>
          </VStack>
        </Card>

        {/* Recent activity heading */}
        <VStack gap={3}>
          <Skeleton width={140} height={22} radius={2} index={14} />
          <Card padding={5} variant="muted">
            <Skeleton width="70%" height={14} radius={2} index={15} />
          </Card>
        </VStack>
      </VStack>
    </PageContainer>
  );
}
