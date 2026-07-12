"use client";

import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Banner } from "@astryxdesign/core/Banner";
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
}: {
  preview: TemplatePreview | null;
  fromEmail?: string;
  toEmail?: string;
  isEmpty: boolean;
  /** Suppress the per-recipient warning banner when a caller already summarizes them
   *  (e.g. the pre-send gate shows one summary above this preview). */
  hideWarnings?: boolean;
}) {
  return (
    <Card padding={5}>
      <PreviewStyles />
      <VStack gap={3} align="stretch">
        <Text size="sm" color="secondary" weight="medium">Preview</Text>
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
