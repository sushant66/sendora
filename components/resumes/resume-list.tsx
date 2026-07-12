"use client";

import { useState } from "react";
import {
  Table,
  useTableRowExpansion,
  useTableRowExpansionState,
  proportional,
  pixel,
  type TableColumn,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import type { Resume, ResumeNode } from "@/lib/resumes/types";

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onRestore,
}: {
  resumes: ResumeNode[];
  onRequestDelete: (resume: Resume) => void;
  onRestore: (version: Resume) => void;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const { data, expansionConfig } = useTableRowExpansionState<ResumeNode>({
    baseData: resumes,
    getChildren: (r) => r.children ?? [],
    getRowKey: (r) => r.id,
    expandedKeys,
    setExpandedKeys,
  });
  const expansion = useTableRowExpansion(expansionConfig);

  const columns: TableColumn<ResumeNode>[] = [
    {
      key: "label",
      header: "Label",
      width: proportional(1.5),
      renderCell: (r) =>
        r.status === "archived" ? (
          <Text color="secondary">Version {r.version}</Text>
        ) : (
          <Text weight="medium">{r.label}</Text>
        ),
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
              { label: "Delete", onClick: () => onRequestDelete(r) },
            ]}
          />
        ) : (
          <MoreMenu
            label={`Actions for ${r.label} version ${r.version}`}
            size="sm"
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
      plugins={{ expansion }}
    />
  );
}
