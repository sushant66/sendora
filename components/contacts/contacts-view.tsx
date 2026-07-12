"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Table, proportional, pixel, useTableSelection, type TableColumn } from "@astryxdesign/core/Table";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Contact, ContactList } from "@/lib/contacts/types";
import { ContactFormDialog } from "./contact-form-dialog";

const SEARCH_DEBOUNCE_MS = 250;
const UNDO_MS = 6000;

/** What a pending delete targets: a single row, or the current selection (loaded ids or all
 *  matching the search). */
type PendingDelete = { mode: "single"; contact: Contact } | { mode: "selection" };

export function ContactsView() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);

  // Selection: explicitly checked loaded rows, plus a two-step "select all matching" mode that
  // reaches beyond the loaded page (FR-020).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchSeq = useRef(0);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, []);

  const load = useCallback(
    async (q: string) => {
      const seq = ++searchSeq.current;
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("query", q.trim());
        const data = await apiRequest<ContactList>(`/api/contacts?${params}`);
        if (seq !== searchSeq.current) return; // a newer search superseded this one
        setContacts(data.items);
        setNextCursor(data.nextCursor);
        clearSelection();
      } catch {
        if (seq === searchSeq.current) toast({ body: "Couldn't load contacts.", type: "error" });
      } finally {
        if (seq === searchSeq.current) setIsLoading(false);
      }
    },
    [toast, clearSelection],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      if (query.trim()) params.set("query", query.trim());
      const data = await apiRequest<ContactList>(`/api/contacts?${params}`);
      setContacts((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      toast({ body: "Couldn't load more contacts.", type: "error" });
    } finally {
      setIsLoadingMore(false);
    }
  }

  function onSaved(saved: Contact, mode: "created" | "updated") {
    setContacts((prev) => (mode === "updated" ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]));
    toast({ body: mode === "created" ? `Added ${saved.name}.` : `Updated ${saved.name}.` });
  }

  const allLoadedSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const canSelectAllMatching = !selectAllMatching && allLoadedSelected && Boolean(nextCursor);

  const selection = useTableSelection<Contact>({
    getIsItemSelected: (c) => selectAllMatching || selectedIds.has(c.id),
    getIsAllSelected: () => selectAllMatching || allLoadedSelected,
    getIsIndeterminate: () => !selectAllMatching && selectedIds.size > 0 && !allLoadedSelected,
    onSelectItem: ({ item, isSelected }) => {
      // Any individual toggle drops "all matching" back to an explicit loaded-row selection.
      setSelectedIds((prev) => {
        const next = new Set(selectAllMatching ? contacts.map((c) => c.id) : prev);
        if (isSelected) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      setSelectAllMatching(false);
    },
    onSelectAll: ({ isAllSelected }) => {
      setSelectAllMatching(false);
      setSelectedIds(isAllSelected ? new Set(contacts.map((c) => c.id)) : new Set());
    },
  });

  async function undoDelete(deletedBatch: string) {
    try {
      const { restored, skipped } = await apiRequest<{ restored: number; skipped: number }>("/api/contacts/restore", {
        method: "POST",
        json: { deletedBatch },
      });
      await load(query);
      toast({
        body:
          skipped > 0
            ? `Restored ${restored}. ${skipped} could not be restored (that email is in use again).`
            : `Restored ${restored} contact${restored === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      const gone = err instanceof ApiError && err.status === 404;
      toast({ body: gone ? "That undo is no longer available." : "Couldn't undo the delete.", type: "error" });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const body =
        pendingDelete.mode === "single"
          ? { ids: [pendingDelete.contact.id] }
          : selectAllMatching
            ? { matchAll: true, query: query.trim() || undefined }
            : { ids: [...selectedIds] };

      const { deletedBatch, count } = await apiRequest<{ deletedBatch: string; count: number }>(
        "/api/contacts/bulk-delete",
        { method: "POST", json: body },
      );

      // Update the loaded list. For matchAll we don't know exactly which loaded rows matched, so reload.
      if (pendingDelete.mode === "selection" && selectAllMatching) {
        await load(query);
      } else {
        const removed = new Set(pendingDelete.mode === "single" ? [pendingDelete.contact.id] : [...selectedIds]);
        setContacts((prev) => prev.filter((c) => !removed.has(c.id)));
        clearSelection();
      }
      setPendingDelete(null);

      // Undo toast (single slot via a fixed id; a new delete replaces it, committing the prior).
      toast({
        uniqueID: "contacts-undo",
        autoHideDuration: UNDO_MS,
        body: `Deleted ${count} contact${count === 1 ? "" : "s"}.`,
        endContent: <Button label="Undo" variant="ghost" size="sm" onClick={() => void undoDelete(deletedBatch)} />,
      });
    } catch (err) {
      const gone = err instanceof ApiError && err.status === 404;
      toast({ body: gone ? "Those contacts no longer exist." : "Couldn't delete the contacts.", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<Contact>[] = [
    { key: "name", header: "Name", width: proportional(1.5) },
    {
      key: "email",
      header: "Email",
      width: proportional(2),
      renderCell: (row) => <Link href={`mailto:${row.email}`}>{row.email}</Link>,
    },
    { key: "company", header: "Company", width: proportional(1.5), renderCell: (row) => row.company ?? "-" },
    { key: "role", header: "Role", width: proportional(1.5), renderCell: (row) => row.role ?? "-" },
    {
      key: "actions",
      header: "",
      width: pixel(72),
      align: "end",
      renderCell: (row) => (
        <MoreMenu
          label={`Actions for ${row.name}`}
          size="sm"
          items={[
            { label: "Edit", onClick: () => { setEditing(row); setFormOpen(true); } },
            { type: "divider" },
            { label: "Delete", onClick: () => setPendingDelete({ mode: "single", contact: row }) },
          ]}
        />
      ),
    },
  ];

  const hasSearch = query.trim().length > 0;
  const selectionActive = selectAllMatching || selectedIds.size > 0;
  const deleteDescription = useMemo(() => {
    if (!pendingDelete) return "";
    if (pendingDelete.mode === "single") {
      return `${pendingDelete.contact.name} (${pendingDelete.contact.email}) will be removed. You can undo for a few seconds.`;
    }
    if (selectAllMatching) {
      return hasSearch
        ? `Every contact matching "${query.trim()}" will be removed. You can undo for a few seconds.`
        : "Every contact will be removed. You can undo for a few seconds.";
    }
    return `${selectedIds.size} contact${selectedIds.size === 1 ? "" : "s"} will be removed. You can undo for a few seconds.`;
  }, [pendingDelete, selectAllMatching, hasSearch, query, selectedIds]);

  return (
    <VStack gap={5}>
      <HStack justify="between" align="center" gap={4}>
        <VStack gap={1}>
          <Heading level={1}>Contacts</Heading>
          <Text color="secondary">Recruiters you can reach out to.</Text>
        </VStack>
        <HStack gap={2}>
          <Button as={Link} href="/contacts/import" label="Import" variant="secondary" />
          <Button label="Add contact" variant="primary" onClick={() => { setEditing(undefined); setFormOpen(true); }} />
        </HStack>
      </HStack>

      <VStack gap={8}>
        <TextInput
          label="Search contacts"
          isLabelHidden
          placeholder="Search by name, email, or company"
          startIcon="search"
          hasClear
          value={query}
          onChange={setQuery}
          size="lg"
        />

        {isLoading ? (
          <TableSkeleton columns={[1.5, 2, 1.5, 1.5, { px: 72 }]} rows={5} />
        ) : contacts.length === 0 ? (
          hasSearch ? (
            <EmptyState
              icon={<SearchGlyph />}
              title={`No contacts match "${query.trim()}"`}
              description="Try a different name, email, or company."
              actions={<Button label="Clear search" variant="secondary" onClick={() => setQuery("")} />}
            />
          ) : (
            <EmptyState
              icon={<PeopleGlyph />}
              title="No contacts yet"
              description="Import recruiters from a CSV or Excel file, paste a list, or add one by hand to get started."
              actions={
                <HStack gap={2}>
                  <Button as={Link} href="/contacts/import" label="Import contacts" variant="primary" />
                  <Button label="Add manually" variant="secondary" onClick={() => { setEditing(undefined); setFormOpen(true); }} />
                </HStack>
              }
            />
          )
        ) : (
          <VStack gap={3}>
            <Table
              data={contacts}
              columns={columns}
              idKey="id"
              density="compact"
              dividers="rows"
              hasHover
              textOverflow="truncate"
              plugins={{ selection }}
            />
            {nextCursor && (
              <HStack justify="center">
                <Button label="Load more" variant="ghost" onClick={loadMore} isLoading={isLoadingMore} />
              </HStack>
            )}
          </VStack>
        )}
      </VStack>

      {/* Bulk-action bar floats over the list (sticky, bottom-centered) so selecting never
          shifts the table, and it stays reachable while scrolling a long list. */}
      {selectionActive && (
        <SelectionBar
          count={selectAllMatching ? null : selectedIds.size}
          canSelectAllMatching={canSelectAllMatching}
          onSelectAllMatching={() => setSelectAllMatching(true)}
          onClear={clearSelection}
          onDelete={() => setPendingDelete({ mode: "selection" })}
        />
      )}

      <ContactFormDialog isOpen={formOpen} onOpenChange={setFormOpen} contact={editing} onSaved={onSaved} />
      <AlertDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={pendingDelete?.mode === "single" ? "Delete contact?" : "Delete contacts?"}
        description={deleteDescription}
        actionLabel="Delete"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </VStack>
  );
}

/**
 * Bulk-selection action bar: a floating pill pinned to the bottom of the content column
 * (sticky, centered), so selecting never pushes the table and it stays reachable while
 * scrolling. Holds the count, the two-step "select all matching", clear, and delete.
 */
function SelectionBar({
  count,
  canSelectAllMatching,
  onSelectAllMatching,
  onClear,
  onDelete,
}: {
  count: number | null;
  canSelectAllMatching: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <VStack
      className="sendora-selection-bar"
      style={{ position: "sticky", bottom: "var(--spacing-6)", alignSelf: "center", zIndex: 30 }}
    >
      <SelectionBarStyles />
      <HStack
        gap={5}
        align="center"
        style={{
          padding: "var(--spacing-2) var(--spacing-2) var(--spacing-2) var(--spacing-4)",
          background: "var(--color-background-surface)",
          border: "var(--border-width) solid var(--color-border-emphasized)",
          borderRadius: "var(--radius-full)",
          boxShadow: "var(--shadow-overlay, 0 12px 32px rgb(0 0 0 / 0.32))",
        }}
      >
        <HStack gap={3} align="center">
          <Text size="sm" weight="medium">
            {count === null ? "All matching contacts selected" : `${count} selected`}
          </Text>
          {canSelectAllMatching && (
            <Button label="Select all matching" variant="ghost" size="sm" onClick={onSelectAllMatching} />
          )}
        </HStack>
        <HStack gap={2} align="center">
          <Button label="Clear" variant="ghost" size="sm" onClick={onClear} />
          <Button label="Delete" variant="destructive" size="sm" onClick={onDelete} />
        </HStack>
      </HStack>
    </VStack>
  );
}

function SelectionBarStyles() {
  return (
    <style>{`
      @keyframes sendora-selbar-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sendora-selection-bar { animation: sendora-selbar-in 180ms cubic-bezier(0.22, 1, 0.36, 1); }
      @media (prefers-reduced-motion: reduce) {
        .sendora-selection-bar { animation: none; }
      }
    `}</style>
  );
}

function SearchGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PeopleGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2.5-4.6" />
    </svg>
  );
}
