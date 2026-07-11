"use client";

import { useEffect, useState } from "react";
import { Table, proportional, pixel, type TableColumn } from "@astryxdesign/core/Table";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import { apiRequest } from "@/lib/api/client";
import type { Template } from "@/lib/templates/types";
import { TemplateEditorDialog } from "./template-editor-dialog";

export function TemplatesView() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Template | undefined>(undefined);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await apiRequest<{ items: Template[] }>("/api/templates");
        setTemplates(items);
      } catch {
        toast({ body: "Couldn't load templates.", type: "error" });
        setTemplates([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSaved(saved: Template, mode: "created" | "updated") {
    setTemplates((prev) => {
      const list = prev ?? [];
      return mode === "updated" ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list];
    });
    toast({ body: mode === "created" ? `Created "${saved.name}".` : `Updated "${saved.name}".` });
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/templates/${deleting.id}`, { method: "DELETE" });
      setTemplates((prev) => (prev ?? []).filter((t) => t.id !== deleting.id));
      toast({ body: `Deleted "${deleting.name}".` });
      setDeleting(null);
    } catch {
      toast({ body: "Couldn't delete the template.", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<Template>[] = [
    {
      key: "name",
      header: "Template",
      width: proportional(2),
      renderCell: (t) => (
        <HStack gap={2} align="center">
          <Text weight="medium">{t.name}</Text>
          {t.kind === "system" && <Badge label="Starter" />}
        </HStack>
      ),
    },
    { key: "subject", header: "Subject", width: proportional(2), renderCell: (t) => <Text color="secondary">{t.subject}</Text> },
    {
      key: "mergeFields",
      header: "Merge fields",
      width: proportional(1.5),
      renderCell: (t) => (
        <Text color="secondary" size="sm">
          {t.mergeFields.length ? t.mergeFields.map((f) => `{{${f}}}`).join(" ") : "-"}
        </Text>
      ),
    },
    {
      key: "actions",
      header: "",
      width: pixel(72),
      align: "end",
      renderCell: (t) =>
        t.kind === "custom" ? (
          <MoreMenu
            label={`Actions for ${t.name}`}
            size="sm"
            items={[
              { label: "Edit", onClick: () => { setEditing(t); setEditorOpen(true); } },
              { type: "divider" },
              { label: "Delete", onClick: () => setDeleting(t) },
            ]}
          />
        ) : (
          <MoreMenu
            label={`Actions for ${t.name}`}
            size="sm"
            items={[
              { label: "Duplicate to customize", onClick: () => { setEditing({ ...t, id: "", kind: "custom", name: `${t.name} (copy)` }); setEditorOpen(true); } },
            ]}
          />
        ),
    },
  ];

  return (
    <VStack gap={8}>
      <HStack justify="between" align="center" gap={4}>
        <VStack gap={1}>
          <Heading level={1}>Templates</Heading>
          <Text color="secondary">Starter templates plus your own. Use them when you compose.</Text>
        </VStack>
        <Button label="New template" variant="primary" onClick={() => { setEditing(undefined); setEditorOpen(true); }} />
      </HStack>

      {templates === null ? (
        <TableSkeleton columns={[2, 2, 1.5, { px: 72 }]} rows={4} />
      ) : templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first template with merge fields to reuse across recruiters."
          actions={<Button label="New template" variant="primary" onClick={() => { setEditing(undefined); setEditorOpen(true); }} />}
        />
      ) : (
        <Table data={templates} columns={columns} idKey="id" density="compact" dividers="rows" hasHover textOverflow="truncate" />
      )}

      <TemplateEditorDialog isOpen={editorOpen} onOpenChange={setEditorOpen} template={editing} onSaved={onSaved} />
      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete template?"
        description={deleting ? `"${deleting.name}" will be removed. Emails already sent are unaffected.` : ""}
        actionLabel="Delete"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </VStack>
  );
}
