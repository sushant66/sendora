import { Skeleton } from "@astryxdesign/core/Skeleton";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Divider } from "@astryxdesign/core/Divider";

/**
 * A number is a proportional column weight (mirrors Astryx `proportional(n)`); an object with
 * `px` is a fixed-width column (mirrors `pixel(n)`, e.g. an actions cell).
 */
export type SkeletonColumn = number | { px: number };

/**
 * Loading placeholder shaped like a real data Table: a header row plus `rows` body rows, each
 * a set of shimmer cells whose widths follow the actual column layout. A single full-width bar
 * per row doesn't represent a columnar table — the shimmer→content swap jumps. This mirrors the
 * component (same column proportions, same compact row rhythm, row dividers) so it doesn't.
 */
export function TableSkeleton({
  columns,
  rows = 5,
}: {
  columns: SkeletonColumn[];
  rows?: number;
}) {
  return (
    <VStack gap={0} align="stretch">
      <SkeletonRow columns={columns} isHeader baseIndex={0} />
      <Divider variant="subtle" />
      {Array.from({ length: rows }).map((_, r) => (
        <VStack key={r} gap={0} align="stretch">
          <SkeletonRow columns={columns} baseIndex={(r + 1) * columns.length} />
          {r < rows - 1 && <Divider variant="subtle" />}
        </VStack>
      ))}
    </VStack>
  );
}

// Varied fills so cells read like text of different lengths, not uniform blocks.
const FILLS = ["70%", "84%", "58%", "64%", "76%"];

function SkeletonRow({
  columns,
  isHeader = false,
  baseIndex,
}: {
  columns: SkeletonColumn[];
  isHeader?: boolean;
  baseIndex: number;
}) {
  return (
    <HStack gap={4} align="center" paddingBlock={3}>
      {columns.map((col, i) => {
        const fixed = typeof col === "object";
        return (
          <HStack
            key={i}
            align="center"
            justify={fixed ? "end" : "start"}
            style={
              fixed
                ? { width: col.px, flexShrink: 0 }
                : { flexGrow: col, flexBasis: 0, minWidth: 0 }
            }
          >
            {fixed ? (
              <Skeleton width={20} height={20} radius="rounded" index={baseIndex + i} />
            ) : (
              <Skeleton
                width={isHeader ? "40%" : FILLS[i % FILLS.length]}
                height={isHeader ? 10 : 14}
                radius={2}
                index={baseIndex + i}
              />
            )}
          </HStack>
        );
      })}
    </HStack>
  );
}
