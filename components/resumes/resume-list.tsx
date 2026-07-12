"use client";

import { useState } from "react";
import {
  Table,
  useTableRowExpansionState,
  proportional,
  pixel,
  type TableColumn,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { HStack } from "@astryxdesign/core/HStack";
import { Badge } from "@astryxdesign/core/Badge";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import type { Resume, ResumeNode } from "@/lib/resumes/types";

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function openResume(id: string): void {
  window.open(`/api/resumes/${id}`, "_blank", "noopener,noreferrer");
}

export function ResumeList({
  resumes,
  onRequestDelete,
  onRequestReplace,
  onRestore,
  restoringId,
}: {
  resumes: ResumeNode[];
  onRequestDelete: (resume: Resume) => void;
  onRequestReplace: (resume: Resume) => void;
  onRestore: (version: Resume) => void;
  /** id of the version currently being restored, if any — disables that row's menu. */
  restoringId: string | null;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Not passed to Table as a plugin — the library's expansion plugin puts the chevron in
  // its own leading column (blank header, separated from "Label" by a full column), which
  // read as "no icon beside the label." Using only `data` + `onToggle` from this hook lets
  // the chevron live inside the Label cell itself, directly beside the text.
  const { data, expansionConfig } = useTableRowExpansionState<ResumeNode>({
    baseData: resumes,
    getChildren: (r) => r.children ?? [],
    getRowKey: (r) => r.id,
    expandedKeys,
    setExpandedKeys,
  });

  const columns: TableColumn<ResumeNode>[] = [
    {
      key: "label",
      header: "Label",
      width: proportional(1.5),
      renderCell: (r) => {
        if (r.status === "archived") {
          return (
            <HStack gap={2} align="center">
              <span style={{ width: "var(--size-element-sm)", flexShrink: 0 }} />
              <Text color="secondary">Version {r.version}</Text>
            </HStack>
          );
        }
        const hasHistory = (r.children?.length ?? 0) > 0;
        const isExpanded = expandedKeys.has(r.id);
        return (
          <HStack gap={1} align="center">
            {hasHistory ? (
              <IconButton
                label={isExpanded ? "Collapse row" : "Expand row"}
                icon={<Icon icon="chevronRight" size="xsm" />}
                variant="ghost"
                size="sm"
                onClick={() => expansionConfig.onToggle(r.id)}
                style={{ transform: isExpanded ? "rotate(90deg)" : undefined, transition: "transform 150ms" }}
              />
            ) : (
              <span style={{ width: "var(--size-element-sm)", flexShrink: 0 }} />
            )}
            <Text weight="medium">{r.label}</Text>
            <Badge label={`v${r.version}`} variant="neutral" />
          </HStack>
        );
      },
    },
    { key: "fileName", header: "File", width: proportional(2) },
    { key: "fileSize", header: "Size", width: pixel(90), renderCell: (r) => formatSize(r.fileSize) },
    { key: "createdAt", header: "Saved", width: pixel(120), renderCell: (r) => formatDate(r.createdAt) },
    {
      key: "actions",
      header: "",
      width: pixel(72),
      align: "end",
      renderCell: (r) =>
        r.status === "active" ? (
          <MoreMenu
            label={`Actions for ${r.label}`}
            size="sm"
            items={[
              { label: "Open", onClick: () => openResume(r.id) },
              { type: "divider" },
              { label: "Update", onClick: () => onRequestReplace(r) },
              { label: "Delete", onClick: () => onRequestDelete(r) },
            ]}
          />
        ) : restoringId === r.id ? (
          <Text color="secondary" size="sm">Restoring…</Text>
        ) : (
          <MoreMenu
            label={`Actions for ${r.label} version ${r.version}`}
            size="sm"
            isDisabled={restoringId !== null}
            items={[
              { label: "Open", onClick: () => openResume(r.id) },
              { type: "divider" },
              { label: "Restore", onClick: () => onRestore(r) },
            ]}
          />
        ),
    },
  ];

  return (
    <Table
      data={data}
      columns={columns}
      idKey="id"
      density="compact"
      dividers="rows"
      hasHover
      textOverflow="truncate"
    />
  );
}
