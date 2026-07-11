"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Table, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import { apiRequest } from "@/lib/api/client";
import type { HistoryItem, HistoryList } from "@/lib/history/types";

const STATUS: Record<HistoryItem["status"], { variant: "success" | "error" | "neutral"; label: string }> = {
  sent: { variant: "success", label: "Sent" },
  failed: { variant: "error", label: "Failed" },
  pending: { variant: "neutral", label: "Pending" },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function HistoryView() {
  const toast = useToast();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest<HistoryList>("/api/history");
        setItems(data.items);
        setNextCursor(data.nextCursor);
      } catch {
        toast({ body: "Couldn't load your sending history.", type: "error" });
        setItems([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const data = await apiRequest<HistoryList>(`/api/history?cursor=${encodeURIComponent(nextCursor)}`);
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      toast({ body: "Couldn't load more history.", type: "error" });
    } finally {
      setIsLoadingMore(false);
    }
  }

  const columns: TableColumn<HistoryItem>[] = [
    { key: "recipientEmail", header: "Recipient", width: proportional(2) },
    { key: "subject", header: "Subject", width: proportional(2), renderCell: (r) => <Text color="secondary">{r.subject}</Text> },
    { key: "templateName", header: "Template", width: proportional(1.5), renderCell: (r) => <Text color="secondary">{r.templateName ?? "—"}</Text> },
    {
      key: "when",
      header: "When",
      width: proportional(1.5),
      renderCell: (r) => <Text color="secondary" size="sm">{formatWhen(r.sentAt ?? r.createdAt)}</Text>,
    },
    {
      key: "status",
      header: "Status",
      width: proportional(1.5),
      renderCell: (r) => {
        const s = STATUS[r.status];
        return (
          <HStack gap={2} align="center">
            <StatusDot variant={s.variant} label={s.label} tooltip={r.failureReason ?? undefined} />
            <Text size="sm" color="secondary">{r.status === "failed" && r.failureReason ? r.failureReason : s.label}</Text>
          </HStack>
        );
      },
    },
  ];

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={1}>History</Heading>
        <Text color="secondary">Every email you&apos;ve sent, with its outcome.</Text>
      </VStack>

      {items === null ? (
        <VStack gap={2}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={44} />)}</VStack>
      ) : items.length === 0 ? (
        <EmptyState
          title="No emails sent yet"
          description="Once you send outreach, each email shows up here with its recipient, template, time, and outcome."
          actions={<Button as={Link} href="/compose" label="Compose an email" variant="primary" />}
        />
      ) : (
        <VStack gap={3}>
          <Table data={items} columns={columns} idKey="id" density="compact" dividers="rows" hasHover textOverflow="truncate" />
          {nextCursor && (
            <HStack justify="center">
              <Button label="Load more" variant="ghost" onClick={loadMore} isLoading={isLoadingMore} />
            </HStack>
          )}
        </VStack>
      )}
    </VStack>
  );
}
