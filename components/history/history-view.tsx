"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import { apiRequest } from "@/lib/api/client";
import type { HistoryBatchRecords, HistoryEvent, HistoryList, HistoryRecord, SendStatus } from "@/lib/history/types";
import { HistoryDetailDrawer } from "./history-detail-drawer";

const STATUS: Record<SendStatus, { variant: "success" | "error" | "neutral"; label: string }> = {
  sent: { variant: "success", label: "Sent" },
  failed: { variant: "error", label: "Failed" },
  pending: { variant: "neutral", label: "Pending" },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function HistoryView() {
  const toast = useToast();
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [batchRecords, setBatchRecords] = useState<Record<string, HistoryRecord[]>>({});
  const [loadingBatch, setLoadingBatch] = useState<Set<string>>(new Set());
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);

  const openRecord = useCallback((id: string) => {
    setOpenRecordId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("record", id);
    window.history.replaceState(null, "", url);
  }, []);

  const closeRecord = useCallback(() => {
    setOpenRecordId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    window.history.replaceState(null, "", url);
  }, []);

  // Refresh the list (used after a resend). setState resolves after the await.
  const loadFirst = useCallback(async () => {
    try {
      const data = await apiRequest<HistoryList>("/api/history");
      setEvents(data.items);
      setNextCursor(data.nextCursor);
    } catch {
      toast({ body: "Couldn't load your sending history.", type: "error" });
      setEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount: restore any deep-linked drawer from the URL, then load the first page.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("record");
    // Restoring the drawer from the URL is a one-time external→state sync, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setOpenRecordId(id);
    void (async () => {
      try {
        const data = await apiRequest<HistoryList>("/api/history");
        setEvents(data.items);
        setNextCursor(data.nextCursor);
      } catch {
        toast({ body: "Couldn't load your sending history.", type: "error" });
        setEvents([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const data = await apiRequest<HistoryList>(`/api/history?cursor=${encodeURIComponent(nextCursor)}`);
      setEvents((prev) => [...(prev ?? []), ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      toast({ body: "Couldn't load more history.", type: "error" });
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function toggleExpand(batchId: string) {
    const next = new Set(expanded);
    if (next.has(batchId)) {
      next.delete(batchId);
      setExpanded(next);
      return;
    }
    next.add(batchId);
    setExpanded(next);
    if (!batchRecords[batchId]) {
      setLoadingBatch((s) => new Set(s).add(batchId));
      try {
        const data = await apiRequest<HistoryBatchRecords>(`/api/history/batch/${batchId}`);
        setBatchRecords((prev) => ({ ...prev, [batchId]: data.records }));
      } catch {
        toast({ body: "Couldn't load the recipients for this send.", type: "error" });
        setExpanded((s) => {
          const n = new Set(s);
          n.delete(batchId);
          return n;
        });
      } finally {
        setLoadingBatch((s) => {
          const n = new Set(s);
          n.delete(batchId);
          return n;
        });
      }
    }
  }

  function recordItem(rec: HistoryRecord, opts: { inset?: boolean } = {}) {
    const s = STATUS[rec.status];
    return (
      <Item
        key={rec.id}
        as="li"
        onClick={() => openRecord(rec.id)}
        density="compact"
        startContent={<StatusDot variant={s.variant} label={s.label} />}
        label={rec.recipientName ?? rec.recipientEmail}
        description={rec.subject}
        descriptionLines={1}
        labelLines={1}
        endContent={
          <HStack gap={3} align="center">
            <Text
              size="sm"
              maxLines={1}
              color={rec.status === "failed" ? undefined : "secondary"}
              style={rec.status === "failed" ? { color: "var(--color-text-red)", maxWidth: "22ch" } : undefined}
            >
              {rec.status === "failed" ? rec.failureReason ?? "Failed" : s.label}
            </Text>
            <Icon icon="chevronRight" size="sm" color="secondary" />
          </HStack>
        }
        style={opts.inset ? { paddingInlineStart: "var(--spacing-8)" } : undefined}
      />
    );
  }

  function eventNode(ev: HistoryEvent) {
    if (ev.kind === "single") {
      if (!ev.record) return null;
      return recordItem(ev.record);
    }
    const isOpen = expanded.has(ev.id);
    const rows = batchRecords[ev.id];
    const isLoading = loadingBatch.has(ev.id);
    return [
      <Item
        key={ev.id}
        as="li"
        onClick={() => toggleExpand(ev.id)}
        isHighlighted={isOpen}
        startContent={<Icon icon={isOpen ? "chevronDown" : "chevronRight"} size="sm" color="secondary" />}
        label={`Sent to ${ev.total} recruiters`}
        description={
          <HStack gap={2} align="center" wrap="wrap">
            <Text size="sm" color="secondary">
              {ev.sent} sent
            </Text>
            {ev.failed > 0 && (
              <Text size="sm" style={{ color: "var(--color-text-red)" }}>
                · {ev.failed} failed
              </Text>
            )}
          </HStack>
        }
        endContent={
          <Text size="sm" color="secondary">
            {formatWhen(ev.when)}
          </Text>
        }
      />,
      ...(isOpen
        ? isLoading || !rows
          ? [
              <Item key={`${ev.id}-loading`} as="li" density="compact" style={{ paddingInlineStart: "var(--spacing-8)" }} label={<Skeleton width={220} height={16} />} />,
            ]
          : rows.map((r) => recordItem(r, { inset: true }))
        : []),
    ];
  }

  return (
    <VStack gap={8}>
      <VStack gap={1}>
        <Heading level={1}>History</Heading>
        <Text color="secondary">Every email you&apos;ve sent, with who it went to and its outcome.</Text>
      </VStack>

      {events === null ? (
        <List hasDividers>
          {Array.from({ length: 5 }, (_, i) => (
            <Item key={i} as="li" label={<Skeleton width={200} height={16} />} endContent={<Skeleton width={90} height={14} />} />
          ))}
        </List>
      ) : events.length === 0 ? (
        <EmptyState
          title="No emails sent yet"
          description="Once you send outreach, each email shows up here — open any one to read exactly what you sent, and its outcome."
          actions={<Button as={Link} href="/compose" label="Compose an email" variant="primary" />}
        />
      ) : (
        <VStack gap={3}>
          <List hasDividers>{events.flatMap((ev) => eventNode(ev) ?? [])}</List>
          {nextCursor && (
            <HStack justify="center">
              <Button label="Load more" variant="ghost" onClick={loadMore} isLoading={isLoadingMore} />
            </HStack>
          )}
        </VStack>
      )}

      <HistoryDetailDrawer recordId={openRecordId} onClose={closeRecord} onResent={loadFirst} />
    </VStack>
  );
}
