"use client";

import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { HStack } from "@astryxdesign/core/HStack";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { FileIcon, PreviewIcon, ReplaceIcon } from "@/components/app-icons";
import type { Resume } from "@/lib/resumes/types";

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The resume shelf: one row per resume, no versioning surfaced. Each row states what it is
 * (label + file) and when it was last touched, with its two common actions visible
 * (Preview, Update) and the rest in an overflow menu. The Update action is deliberately not
 * buried: refreshing a resume is the most common thing a job seeker does here.
 */
export function ResumeList({
  resumes,
  onPreview,
  onRequestReplace,
  onRequestDelete,
}: {
  resumes: Resume[];
  onPreview: (resume: Resume) => void;
  onRequestReplace: (resume: Resume) => void;
  onRequestDelete: (resume: Resume) => void;
}) {
  return (
    <List hasDividers>
      {resumes.map((r) => (
        <Item
          key={r.id}
          as="li"
          align="center"
          startContent={<Icon icon={FileIcon} size="md" color="secondary" />}
          label={r.label}
          labelLines={1}
          description={`${r.fileName} · ${formatSize(r.fileSize)} · Updated ${formatDate(r.updatedAt)}`}
          descriptionLines={1}
          endContent={
            <HStack gap={2} align="center">
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={PreviewIcon} size="xsm" />}
                label="Preview"
                onClick={() => onPreview(r)}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon icon={ReplaceIcon} size="xsm" />}
                label="Update"
                onClick={() => onRequestReplace(r)}
              />
              <MoreMenu
                label={`More actions for ${r.label}`}
                size="sm"
                items={[
                  { label: "Open in new tab", onClick: () => window.open(`/api/resumes/${r.id}`, "_blank", "noopener,noreferrer") },
                  { type: "divider" },
                  { label: "Delete", onClick: () => onRequestDelete(r) },
                ]}
              />
            </HStack>
          }
        />
      ))}
    </List>
  );
}
