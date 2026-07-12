"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { TemplatePreview } from "@/lib/templates/types";

/**
 * Live preview of the merge-resolved email (User Story 2). The HTML is produced and
 * sanitized server-side by /api/templates/preview, so rendering it here is safe. It never
 * contains a literal {{token}} (SC-004); empty optional fields are shown as warnings.
 */
export function EmailPreview({
  preview,
  fromEmail,
  toEmail,
  isEmpty,
  hideWarnings = false,
  canCopy = false,
}: {
  preview: TemplatePreview | null;
  fromEmail?: string;
  toEmail?: string;
  isEmpty: boolean;
  /** Suppress the per-recipient warning banner when a caller already summarizes them
   *  (e.g. the pre-send gate shows one summary above this preview). */
  hideWarnings?: boolean;
  /** Offer a "Copy text" action (the compose preview); off inside the pre-send gate,
   *  where the preview is a decision aid, not something to copy out. */
  canCopy?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  function flashCopyState(state: "copied" | "failed") {
    setCopyState(state);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), state === "copied" ? 1600 : 2600);
  }

  async function copyText() {
    // Read the rendered body so the copied text keeps its line breaks (innerText, not the raw
    // HTML). Prefix the subject so the clipboard holds the whole email, ready to paste.
    const body = bodyRef.current?.innerText.trim() ?? "";
    const subject = preview?.subject?.trim();
    const text = subject ? `${subject}\n\n${body}` : body;
    if (!text) return;
    try {
      // Clipboard access needs a secure context (https/localhost) and can be denied; without
      // the API there is nothing to fall back to, so surface the failure on the button.
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      flashCopyState("copied");
    } catch {
      // Blocked (insecure context / permission): tell the user instead of a silent no-op.
      flashCopyState("failed");
    }
  }

  const copied = copyState === "copied";
  const failed = copyState === "failed";

  const showCopy = canCopy && !isEmpty && !!preview;

  return (
    <Card padding={5}>
      <PreviewStyles />
      <VStack gap={3} align="stretch">
        <HStack justify="between" align="center" gap={2}>
          <Text size="sm" color="secondary" weight="medium">Preview</Text>
          {showCopy && (
            <Button
              label={copied ? "Copied" : failed ? "Couldn't copy" : "Copy text"}
              icon={<Icon icon={copied ? "checkDouble" : "copy"} size="sm" />}
              variant="secondary"
              size="sm"
              onClick={copyText}
              tooltip={
                failed
                  ? "Copying needs a secure (https) page and clipboard permission. Select the text to copy it manually."
                  : "Copy this email's text to your clipboard"
              }
            />
          )}
        </HStack>
        {isEmpty || !preview ? (
          <EmptyState
            isCompact
            title="Nothing to preview yet"
            description="Pick a recipient and a template (or write a subject and body) to see the email."
          />
        ) : (
          <VStack gap={3} align="stretch">
            <VStack gap={1} align="stretch">
              {fromEmail && <Text size="sm" color="secondary">From: {fromEmail}</Text>}
              {toEmail && <Text size="sm" color="secondary">To: {toEmail}</Text>}
              <Heading level={3}>{preview.subject || "(no subject)"}</Heading>
            </VStack>
            <Divider />
            <div
              ref={bodyRef}
              className="sendora-email-body"
              // Safe: preview.bodyHtml is server-sanitized by /api/templates/preview (lib/sanitize).
              dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
            />
            {!hideWarnings && preview.warnings.length > 0 && (
              <Banner
                status="warning"
                container="card"
                title="Some fields are empty for this recipient"
                description={preview.warnings.map((w) => w.message).join(" ")}
              />
            )}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

function PreviewStyles() {
  return (
    <style>{`
      .sendora-email-body { color: var(--color-text-primary); font-size: var(--font-size-base); line-height: 1.6; }
      .sendora-email-body p { margin: 0 0 var(--spacing-2); }
      .sendora-email-body ul, .sendora-email-body ol { margin: 0 0 var(--spacing-2); padding-inline-start: var(--spacing-6); }
      .sendora-email-body a { color: var(--color-text-accent); text-decoration: underline; }
    `}</style>
  );
}
