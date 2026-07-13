"use client";

import { Dialog } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Divider } from "@astryxdesign/core/Divider";
import { DownloadIcon, ReplaceIcon, TrashIcon } from "@/components/app-icons";
import type { Resume } from "@/lib/resumes/types";

/** Force a download (the stream route serves `inline`, so an anchor's download attr wins). */
function download(resume: Resume): void {
  const a = document.createElement("a");
  a.href = `/api/resumes/${resume.id}`;
  a.download = resume.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Reads a resume inline instead of ejecting the user to a raw browser tab. The PDF is
 * embedded in an iframe (browsers render `application/pdf` natively), with the file's own
 * actions in the frame: download, open in a real tab, update, delete.
 */
export function ResumePreviewDialog({
  resume,
  onOpenChange,
  onRequestUpdate,
  onRequestDelete,
}: {
  /** The resume being previewed, or null when closed. */
  resume: Resume | null;
  onOpenChange: (open: boolean) => void;
  onRequestUpdate: (resume: Resume) => void;
  onRequestDelete: (resume: Resume) => void;
}) {
  return (
    <Dialog
      isOpen={resume !== null}
      onOpenChange={onOpenChange}
      purpose="info"
      width="min(960px, 96vw)"
      maxHeight="92vh"
      padding={0}
      aria-label={resume ? `Preview of ${resume.label}` : "Resume preview"}
    >
      {resume && (
        <VStack gap={0} style={{ height: "min(92vh, 920px)" }}>
          {/* Header: identity + file-level actions */}
          <HStack justify="between" align="center" gap={3} paddingInline={5} paddingBlock={4}>
            <VStack gap={1} style={{ minWidth: 0 }}>
              <Heading level={2} type="display-3">
                {resume.label}
              </Heading>
              <Text size="sm" color="secondary" maxLines={1}>
                {resume.fileName}
              </Text>
            </VStack>
            <HStack gap={2} align="center">
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={DownloadIcon} size="xsm" />}
                label="Download"
                onClick={() => download(resume)}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon="externalLink" size="xsm" />}
                label="Open in tab"
                onClick={() => window.open(`/api/resumes/${resume.id}`, "_blank", "noopener,noreferrer")}
              />
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                icon={<Icon icon="close" size="sm" />}
                label="Close preview"
                onClick={() => onOpenChange(false)}
              />
            </HStack>
          </HStack>
          <Divider />

          {/* The document itself */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <iframe
              title={`${resume.label} (${resume.fileName})`}
              src={`/api/resumes/${resume.id}#view=FitH`}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          </div>
          <Divider />

          {/* Footer: mutations, kept apart from the read-only actions above */}
          <HStack justify="between" align="center" paddingInline={5} paddingBlock={3}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon={TrashIcon} size="xsm" />}
              label="Delete"
              onClick={() => onRequestDelete(resume)}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Icon icon={ReplaceIcon} size="xsm" />}
              label="Update file"
              onClick={() => onRequestUpdate(resume)}
            />
          </HStack>
        </VStack>
      )}
    </Dialog>
  );
}
