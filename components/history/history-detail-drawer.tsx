"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Icon } from "@astryxdesign/core/Icon";
import { Divider } from "@astryxdesign/core/Divider";
import { Banner } from "@astryxdesign/core/Banner";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { useToast } from "@astryxdesign/core/Toast";
import { apiRequest } from "@/lib/api/client";
import type { HistoryDetail, ResendResult, SendStatus } from "@/lib/history/types";
import styles from "./history-detail-drawer.module.css";

const STATUS: Record<SendStatus, { variant: "success" | "error" | "neutral"; label: string }> = {
  sent: { variant: "success", label: "Sent" },
  failed: { variant: "error", label: "Failed" },
  pending: { variant: "neutral", label: "Pending" },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * The sent-email detail sheet. Renders the immutable snapshot (subject + body exactly as
 * sent), its provenance, and — for a failed send — an inline-confirmed Resend.
 */
export function HistoryDetailDrawer({
  recordId,
  onClose,
  onResent,
}: {
  recordId: string | null;
  onClose: () => void;
  onResent: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [confirmingResend, setConfirmingResend] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    let active = true;
    void (async () => {
      try {
        const data = await apiRequest<HistoryDetail>(`/api/history/${recordId}`);
        if (active) {
          setDetail(data);
          setConfirmingResend(false);
        }
      } catch {
        if (active) {
          toast({ body: "Couldn't load that email.", type: "error" });
          onClose();
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function resend() {
    if (!detail) return;
    setResending(true);
    try {
      const res = await apiRequest<ResendResult>(`/api/history/${detail.id}/resend`, { method: "POST" });
      if (res.status === "sent") {
        toast({
          body: res.attachmentDropped
            ? `Resent to ${detail.recipientName ?? detail.recipientEmail}, but the attached resume could no longer be included.`
            : `Resent to ${detail.recipientName ?? detail.recipientEmail}.`,
          type: res.attachmentDropped ? "error" : undefined,
        });
        onResent();
        onClose();
      } else {
        toast({ body: `Resend failed: ${res.reason ?? "unknown error"}`, type: "error" });
        onResent();
        setConfirmingResend(false);
      }
    } catch {
      toast({ body: "Couldn't resend. Check your connected Gmail and try again.", type: "error" });
    } finally {
      setResending(false);
    }
  }

  // While a newly-opened record is still loading, the previous detail may linger — treat
  // a mismatch as loading so we show the skeleton for the record actually requested.
  const loading = detail === null || detail.id !== recordId;
  const recipient = !loading && detail ? detail.recipientName ?? detail.recipientEmail : "";
  const status = !loading && detail ? STATUS[detail.status] : null;

  return (
    <Dialog
      isOpen={recordId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="info"
      width="min(520px, 100vw)"
      maxHeight="100dvh"
      position={{ top: 0, right: 0, bottom: 0 }}
      padding={0}
      aria-label="Sent email details"
    >
      <VStack gap={0} className={styles.sheet}>
        {/* Header */}
        <HStack justify="between" align="start" gap={3} paddingInline={5} paddingBlock={4}>
          <VStack gap={1} style={{ minWidth: 0 }}>
            <Text size="sm" color="secondary">
              Sent email
            </Text>
            <Heading level={2} type="display-3">
              {loading ? <Skeleton width={180} height={20} /> : recipient}
            </Heading>
          </VStack>
          <Button variant="ghost" icon={<Icon icon="close" size="sm" />} label="Close" isIconOnly onClick={onClose} />
        </HStack>
        <Divider />

        {/* Body (scrolls) */}
        <VStack gap={5} paddingInline={5} paddingBlock={5} style={{ overflowY: "auto", flex: 1 }}>
          {loading || !detail ? (
            <VStack gap={4}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="90%" height={14} />
              <Skeleton width="100%" height={120} />
            </VStack>
          ) : (
            <>
              {/* Provenance */}
              <VStack gap={2}>
                <HStack gap={2} align="center" wrap="wrap">
                  {status && <StatusDot variant={status.variant} label={status.label} />}
                  <Text size="sm" color="secondary">
                    {formatWhen(detail.sentAt ?? detail.createdAt)}
                  </Text>
                </HStack>
                <MetaRow label="To" value={detail.recipientName ? `${detail.recipientName} · ${detail.recipientEmail}` : detail.recipientEmail} />
                <MetaRow label="From" value={detail.fromEmail || "your connected inbox"} />
                {detail.attachedResume && (
                  <HStack gap={2} align="center" wrap="wrap">
                    <Text size="sm" color="secondary" style={{ minWidth: "3.5ch" }}>
                      Attached
                    </Text>
                    {/* The exact file this recipient received — retained even after the shelf
                        moved on, so it opens the precise PDF that went out. */}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon="externalLink" size="xsm" />}
                      label={`${detail.attachedResume.label} (${detail.attachedResume.fileName})`}
                      onClick={() =>
                        window.open(`/api/resumes/${detail.attachedResume!.id}`, "_blank", "noopener,noreferrer")
                      }
                    />
                  </HStack>
                )}
              </VStack>

              {/* Failure + resend */}
              {detail.status === "failed" && (
                <Banner status="error" title="This email didn't send">
                  <VStack gap={3} align="start">
                    <Text size="sm">{detail.failureReason ?? "The provider rejected the message."}</Text>
                    {confirmingResend ? (
                      <HStack gap={2} align="center" wrap="wrap">
                        <Text size="sm">Resend the same email to {recipient}?</Text>
                        <Button variant="primary" size="sm" label="Resend" onClick={resend} isLoading={resending} />
                        <Button variant="ghost" size="sm" label="Cancel" onClick={() => setConfirmingResend(false)} isDisabled={resending} />
                      </HStack>
                    ) : (
                      <Button variant="secondary" size="sm" label="Resend" onClick={() => setConfirmingResend(true)} />
                    )}
                  </VStack>
                </Banner>
              )}

              {/* The message, exactly as sent */}
              <VStack gap={3}>
                <Heading level={3}>{detail.subject}</Heading>
                {/* Stored HTML, sanitized at send time, shown read-only. */}
                <div className={styles.emailBody} dangerouslySetInnerHTML={{ __html: detail.bodyHtml }} />
              </VStack>

              {/* Batch context */}
              {detail.batch.kind === "bulk" && (
                <>
                  <Divider variant="subtle" />
                  <Text size="sm" color="secondary">
                    Part of a send to {detail.batch.total} recruiters · {detail.batch.sent} sent · {detail.batch.failed} failed
                  </Text>
                </>
              )}
            </>
          )}
        </VStack>
      </VStack>
    </Dialog>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack gap={2} align="start">
      <Text size="sm" color="secondary" style={{ minWidth: "3.5ch" }}>
        {label}
      </Text>
      <Text size="sm" weight="medium">
        {value}
      </Text>
    </HStack>
  );
}
